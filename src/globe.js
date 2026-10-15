import * as THREE from 'three'
import { feature } from 'topojson-client'
import land110 from 'world-atlas/land-110m.json'

// Hub cities [lat, lon]
const HUBS = {
  MNL: [14.6, 121.0],
  SIN: [1.35, 103.8],
  SYD: [-33.9, 151.2],
  HKG: [22.3, 114.2],
  TYO: [35.7, 139.7],
  LAX: [33.9, -118.4],
  DXB: [25.2, 55.3],
  RTM: [51.9, 4.5],
  SHA: [31.2, 121.5],
  AKL: [-36.8, 174.8],
  MEL: [-37.8, 144.9],
  BNE: [-27.5, 153.0],
}
const ROUTES = [
  ['MNL', 'SYD'], ['MNL', 'LAX'], ['SIN', 'RTM'], ['HKG', 'MEL'], ['TYO', 'LAX'],
  ['SIN', 'DXB'], ['SHA', 'SYD'], ['MNL', 'SIN'], ['AKL', 'HKG'], ['BNE', 'TYO'],
  ['DXB', 'RTM'], ['SYD', 'LAX'],
]

const R = 1

function latLonToVec(lat, lon, r = R) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  )
}

// Rasterise land polygons to an equirectangular mask we can sample.
function buildLandMask(w = 1024, h = 512) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#fff'
  const geo = feature(land110, land110.objects.land)
  const px = ([lon, lat]) => [((lon + 180) / 360) * w, ((90 - lat) / 180) * h]
  for (const f of geo.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    for (const poly of polys) {
      ctx.beginPath()
      for (const ring of poly) {
        let prevX = null
        ring.forEach((c, i) => {
          const [x, y] = px(c)
          // break the path where a ring jumps across the antimeridian
          if (i === 0 || (prevX !== null && Math.abs(x - prevX) > w / 2)) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
          prevX = x
        })
        ctx.closePath()
      }
      ctx.fill('evenodd')
    }
  }
  const data = ctx.getImageData(0, 0, w, h).data
  return (lat, lon) => {
    const x = Math.min(w - 1, Math.floor(((lon + 180) / 360) * w))
    const y = Math.min(h - 1, Math.floor(((90 - lat) / 180) * h))
    return data[(y * w + x) * 4] > 127
  }
}

function buildDots(isLand, count) {
  const positions = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const t = golden * i
    const v = new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r)
    const lat = 90 - (Math.acos(v.y) * 180) / Math.PI
    let lon = (Math.atan2(v.z, -v.x) * 180) / Math.PI - 180
    if (lon < -180) lon += 360
    if (isLand(lat, lon)) positions.push(v.x * 1.002, v.y * 1.002, v.z * 1.002)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return g
}

const dotMat = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uSize: { value: 2.2 }, uPixelRatio: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uSize; uniform float uPixelRatio;
      varying float vFacing;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vec3 n = normalize(normalMatrix * position);
        vFacing = dot(n, normalize(-mv.xyz));
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * uPixelRatio;
      }`,
    fragmentShader: /* glsl */ `
      varying float vFacing;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        if(length(c) > 0.5) discard;
        float a = smoothstep(0.0, 0.35, vFacing);
        gl_FragColor = vec4(vec3(0.86,0.9,1.0), a * 0.85);
      }`,
  })

// Rim light: orange at the top, electric blue lower-left, like an atmosphere at dawn.
const atmosphereMat = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vView;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vN; varying vec3 vView;
      void main(){
        float rim = pow(clamp(1.0 - abs(dot(vN, vView)), 0.0, 1.0), 2.2);
        float up = smoothstep(-0.2, 0.9, vN.y + vN.x * 0.25);
        vec3 col = mix(vec3(0.05,0.35,1.0), vec3(1.0,0.32,0.12), up);
        gl_FragColor = vec4(col, 1.0) * rim * 1.6;
      }`,
  })

const surfaceMat = () =>
  new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vView;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vN; varying vec3 vView;
      void main(){
        float f = pow(1.0 - max(dot(vN, vView), 0.0), 3.0);
        float up = smoothstep(-0.3, 0.9, vN.y + vN.x * 0.25);
        vec3 rim = mix(vec3(0.1,0.45,1.0), vec3(1.0,0.4,0.2), up);
        gl_FragColor = vec4(vec3(0.004,0.006,0.02) + rim * f * 1.4, 1.0);
      }`,
  })

function buildArc(a, b, color) {
  const va = latLonToVec(...a)
  const vb = latLonToVec(...b)
  const dist = va.distanceTo(vb)
  const mid = va.clone().add(vb).multiplyScalar(0.5).normalize().multiplyScalar(R + dist * 0.35)
  const curve = new THREE.QuadraticBezierCurve3(va, mid, vb)
  const pts = curve.getPoints(80)
  const g = new THREE.BufferGeometry().setFromPoints(pts)
  const t = new Float32Array(pts.length).map((_, i) => i / (pts.length - 1))
  g.setAttribute('aT', new THREE.BufferAttribute(t, 1))
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uHead: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      attribute float aT; varying float vT;
      void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uHead; uniform vec3 uColor; varying float vT;
      void main(){
        float d = uHead - vT;
        float trail = smoothstep(0.55, 0.0, d) * step(0.0, d);
        float base = 0.18;
        float a = max(trail, base * step(vT, uHead));
        gl_FragColor = vec4(uColor, a);
      }`,
  })
  return { line: new THREE.Line(g, m), mat: m }
}

export function createGlobe(canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  renderer.setPixelRatio(dpr)
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
  camera.position.set(0, 0, 4.2)

  const pivot = new THREE.Group() // positioned in screen space
  const tilt = new THREE.Group() // axial tilt
  const spin = new THREE.Group() // rotation
  scene.add(pivot)
  pivot.add(tilt)
  tilt.add(spin)
  tilt.rotation.z = 0.32
  tilt.rotation.x = 0.35

  const sphereGeo = new THREE.SphereGeometry(R, 96, 96)
  const surface = new THREE.Mesh(sphereGeo, surfaceMat())
  spin.add(surface)

  const atmoGeo = new THREE.SphereGeometry(R * 1.14, 96, 96)
  const atmosphere = new THREE.Mesh(atmoGeo, atmosphereMat())
  tilt.add(atmosphere)

  const isLand = buildLandMask()
  const dotsGeo = buildDots(isLand, 60000)
  const dm = dotMat()
  dm.uniforms.uPixelRatio.value = dpr
  const dots = new THREE.Points(dotsGeo, dm)
  spin.add(dots)

  const arcs = ROUTES.map(([a, b], i) => {
    const arc = buildArc(HUBS[a], HUBS[b], i % 3 === 0 ? '#ffd1b8' : '#ff6a3d')
    arc.offset = i * 0.37
    arc.speed = 0.18 + (i % 4) * 0.04
    spin.add(arc.line)
    return arc
  })

  const hubGeo = new THREE.SphereGeometry(0.008, 8, 8)
  const hubMat = new THREE.MeshBasicMaterial({ color: '#ff8a5c' })
  Object.values(HUBS).forEach((ll) => {
    const m = new THREE.Mesh(hubGeo, hubMat)
    m.position.copy(latLonToVec(...ll, R * 1.003))
    spin.add(m)
  })

  // Face APAC towards the camera
  spin.rotation.y = -3.75

  const state = { progress: 0, pointerX: 0, pointerY: 0 }
  let w = 1
  let h = 1
  let base = { x: 0, y: 0, s: 1 }

  function layout() {
    w = canvas.clientWidth
    h = canvas.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    // Globe sits to the right, partly cropped, like a horizon. On narrow screens it rises behind the copy.
    const visH = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z
    const visW = visH * camera.aspect
    if (w < 760) base = { x: visW * 0.18, y: visH * 0.22, s: 0.9 }
    else base = { x: visW * 0.3, y: visH * 0.06, s: 1.08 }
  }
  layout()

  let running = true
  let raf = 0
  const clock = new THREE.Clock()

  function frame() {
    if (!running) return
    raf = requestAnimationFrame(frame)
    const dt = Math.min(clock.getDelta(), 0.05)
    const t = clock.elapsedTime
    const p = state.progress

    if (!reducedMotion) spin.rotation.y += dt * 0.02
    // Scroll: globe swings to centre and the camera dives towards its blue limb.
    const ease = p * p * (3 - 2 * p)
    pivot.position.x = base.x * (1 - ease) + state.pointerX * 0.04
    pivot.position.y = base.y * (1 - ease) - ease * 1.3 + state.pointerY * 0.03
    pivot.scale.setScalar(base.s * (1 + ease * 1.6))
    tilt.rotation.x = 0.35 + ease * 0.9

    arcs.forEach((a) => {
      a.mat.uniforms.uHead.value = reducedMotion ? 1 : ((t * a.speed + a.offset) % 1.6)
    })
    renderer.render(scene, camera)
  }
  frame()

  const onResize = () => layout()
  const onPointer = (e) => {
    state.pointerX = (e.clientX / window.innerWidth - 0.5) * 2
    state.pointerY = -(e.clientY / window.innerHeight - 0.5) * 2
  }
  window.addEventListener('resize', onResize)
  window.addEventListener('pointermove', onPointer)

  return {
    setProgress(p) { state.progress = p },
    pause() {
      if (!running) return
      running = false
      cancelAnimationFrame(raf)
    },
    resume() {
      if (running) return
      running = true
      clock.getDelta()
      frame()
    },
    dispose() {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointer)
      scene.traverse((o) => {
        o.geometry?.dispose()
        o.material?.dispose()
      })
      renderer.dispose()
    },
  }
}
