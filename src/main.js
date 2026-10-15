import './style.css'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { createGlobe } from './globe.js'
import { scramble, scrambleAt } from './scramble.js'

gsap.registerPlugin(ScrollTrigger)

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]

/* ---------- smooth scroll ---------- */
let lenis = null
if (!reduced) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true })
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((t) => lenis.raf(t * 1000))
  gsap.ticker.lagSmoothing(0)
  $$('a[href^="#"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const target = $(a.getAttribute('href'))
      if (!target) return
      e.preventDefault()
      lenis.scrollTo(target, { duration: 1.6 })
    }),
  )
}

/* ---------- globe ---------- */
const globe = createGlobe($('.globe'), { reducedMotion: reduced })

ScrollTrigger.create({
  trigger: '.hero',
  start: 'top top',
  end: 'bottom top',
  onUpdate: (s) => globe.setProgress(Math.min(1, s.progress * 1.25)),
  onLeave: () => globe.pause(),
  onEnterBack: () => globe.resume(),
})

gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: true } })
  .to('.hero__content', { y: -80, opacity: 0, ease: 'none' }, 0)
  .to('.hero__scroll', { opacity: 0, ease: 'none', duration: 0.3 }, 0)
  .to('.hero__glow', { opacity: 0, ease: 'none' }, 0.2)
  .to('.globe', { filter: 'brightness(1.6) saturate(1.3)', ease: 'none' }, 0.4)
  .to('.hero__dive', { opacity: 1, ease: 'power1.in', duration: 0.5 }, 0.5)

/* ---------- loader + intro text ---------- */
function intro() {
  const lines = $$('.hero [data-scramble]')
  lines.forEach((el) => (el.dataset.text = el.textContent))
  const navLinks = $$('.nav [data-scramble]')
  if (reduced) {
    $('.loader').remove()
    return
  }
  lines.forEach((el) => (el.textContent = ' '))
  const tl = gsap.timeline()
  tl.to('.loader__bar i', { scaleX: 1, duration: 1.1, ease: 'power2.inOut' })
    .add(() => scramble($('.loader__word'), { duration: 700 }), 0)
    .to('.loader', { yPercent: -100, duration: 0.9, ease: 'power3.inOut' }, '+=0.15')
    .add(() => {
      $('.loader').remove()
      lines.forEach((el, i) => scramble(el, { duration: 900, delay: i * 140 }))
      navLinks.forEach((el, i) => scramble(el, { duration: 600, delay: 300 + i * 60 }))
    }, '-=0.35')
    .from('.hero__lede, .hero__actions', { opacity: 0, y: 20, duration: 0.8, stagger: 0.1, ease: 'power2.out' }, '+=0.5')
}

/* ---------- port: intro → stacker → truck → top-down ---------- */
function port() {
  const counters = $$('.port [data-count]')
  const caption = $('[data-phase]')
  const phases = ['01 — About us', '02 — Container pickup', '03 — Loaded on the chassis', '04 — Out on the road']

  gsap.set('.side', { y: '75vh' })
  gsap.set(['.stacker', '.box'], { x: '-45vw' })
  gsap.set('.truck-side', { x: '105vw' })
  const worldScale = window.innerWidth < 760 ? 0.56 : 0.82
  gsap.set('.side__world', { scale: worldScale })

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '.port',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.6,
      onUpdate: (s) => {
        const i = Math.min(phases.length - 1, Math.floor(s.progress * 4.4))
        if (caption.textContent !== phases[i]) caption.textContent = phases[i]
      },
    },
  })

  // 0 → 1.2: intro copy leaves, headline climbs, stats count up
  tl.to('.intro__thumb', { y: '-30vh', opacity: 0, duration: 1 }, 0)
    .to('.intro__copy', { y: '-25vh', opacity: 0, duration: 1 }, 0.1)
    .to('.port__title', { y: () => -window.innerHeight * 0.4, duration: 1.2, ease: 'power1.inOut' }, 0)
    .to('.stat', { opacity: 1, duration: 0.4, stagger: 0.15 }, 0.7)
    .to(counters.map(() => ({ v: 0 })), {
      v: (i) => +counters[i].dataset.count,
      duration: 0.9,
      onUpdate() {
        this.targets().forEach((o, i) => (counters[i].textContent = Math.round(o.v)))
      },
    }, 0.7)
    // 0.6 → 1.6: the yard rises into view
    .to('.side', { y: 0, duration: 1, ease: 'power2.out' }, 0.6)
    // 1.4 → 3: stacker drives in holding the container
    .to(['.stacker', '.box'], { x: 0, duration: 1.6, ease: 'power1.inOut' }, 1.4)
    .to('.box', { y: '-1vw', duration: 0.8, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 1.4)
    // 3 → 4.4: truck reverses under the load
    .to('.truck-side', { x: 0, duration: 1.4, ease: 'power2.out' }, 3)
    // 4.4 → 5.2: container is lowered onto the chassis
    .to('.box', { y: () => vw(BOX_DROP), duration: 0.8, ease: 'power2.inOut' }, 4.4)
    // 5.2 → 6.2: stacker backs away
    .to('.stacker', { x: '-60vw', duration: 1, ease: 'power1.in' }, 5.2)
    // 5.6 → 7.2: truck pulls out, camera pulls up
    .to(['.truck-side', '.box'], { x: '28vw', duration: 1.6, ease: 'power1.in' }, 5.6)
    .to('.side__world', { scale: worldScale * 0.7, duration: 1.6, ease: 'power1.inOut' }, 5.6)
    .to('.stack', { x: '-30vw', opacity: 0, duration: 1.2 }, 5.6)
    .to(['.port__title', '.stat'], { opacity: 0, duration: 0.8 }, 5.8)
    // 7 → 8: camera tilts to look straight down
    .to('.side', { rotateX: 78, opacity: 0, duration: 1, ease: 'power2.in' }, 7)
    .to('.top', { opacity: 1, duration: 0.6 }, 7.5)

  // 7.6 → 10: truck follows the road from overhead
  const path = $('.road__motion')
  const truck = $('.truck-top')
  const len = path.getTotalLength()
  const ride = { p: 0 }
  const place = () => {
    const box = $('.top').getBoundingClientRect()
    const ctm = path.getScreenCTM()
    if (!ctm) return
    const at = (d) => {
      const p = path.getPointAtLength(d)
      return new DOMPoint(p.x, p.y).matrixTransform(ctm)
    }
    const d = ride.p * len
    const a = at(d)
    const b = at(Math.min(len, d + 4))
    const c = at(Math.max(0, d - 4))
    const angle = (Math.atan2(b.y - c.y, b.x - c.x) * 180) / Math.PI
    const tw = truck.offsetWidth
    const th = truck.offsetHeight
    gsap.set(truck, { x: a.x - box.left - tw / 2, y: a.y - box.top - th / 2, rotation: angle })
  }
  tl.fromTo(ride, { p: 0.06 }, { p: 0.94, duration: 2.4, ease: 'power1.inOut', onUpdate: place }, 7.6)
  place()
  window.addEventListener('resize', place)
}

// distance (in vw) the container drops when lowered onto the trailer; tuned to the artwork
const BOX_DROP = 2.8
const vw = (n) => `${n}vw`

/* ---------- milestone panels ---------- */
function milestone() {
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '.milestone', start: 'top top', end: 'bottom bottom', scrub: 0.6 },
  })
  tl.fromTo('.truck-lane', { y: '-70vh' }, { y: '30vh', duration: 3 }, 0)
    .from('.features li', { opacity: 0, y: 40, stagger: 0.25, duration: 0.6 }, 0.2)
    .fromTo('.panel--l .display .dark', { color: '#8b9096' }, { color: '#0a0b0d', duration: 1 }, 0.4)
    .to('.ocean-peek', { opacity: 1, duration: 0.6 }, 2.6)
    .to('.panel--l', { xPercent: -100, duration: 1.4, ease: 'power2.in' }, 2.8)
    .to('.panel--r', { xPercent: 100, duration: 1.4, ease: 'power2.in' }, 2.8)
    .to('.lane', { opacity: 0, duration: 0.5 }, 2.8)
    .fromTo('.ocean-peek', { scale: 1.25 }, { scale: 1, duration: 1.6 }, 2.6)
}

/* ---------- ocean: ship, features, clouds ---------- */
function ocean() {
  const titleLines = $$('.ocean__title span')
  titleLines.forEach((el) => (el.dataset.text = el.textContent))
  const items = $$('.orbit__item')
  const itemTitles = items.map((li) => $('h3', li))
  itemTitles.forEach((el) => (el.dataset.text = el.textContent))

  const st = { title: 0, out: 0, items: 0 }
  const drawText = () => {
    titleLines.forEach((el, i) => scrambleAt(el, Math.max(0, Math.min(1, st.title * 1.6 - i * 0.2)) * (1 - st.out)))
    itemTitles.forEach((el, i) => scrambleAt(el, Math.max(0, Math.min(1, st.items * 2 - i * 0.2))))
  }

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '.ocean', start: 'top top', end: 'bottom bottom', scrub: 0.6 },
    onUpdate: drawText,
  })
  tl.fromTo('.ship', { scale: 1.9, y: '10vh' }, { scale: 1, y: 0, duration: 3, ease: 'power1.out' }, 0)
    .fromTo(st, { title: 0 }, { title: 1, duration: 1.2 }, 0.8)
    .to(st, { out: 1, duration: 0.6 }, 2.6)
    .to(st, { items: 1, duration: 1.4 }, 3)
    .to(items, { opacity: 1, duration: 0.5, stagger: 0.15 }, 3)
    .to('.ship', { scale: 0.55, duration: 2.5, ease: 'power1.in' }, 4)
    .to(items, { opacity: 0, y: -30, duration: 0.6, stagger: 0.05 }, 5.2)
    // climbing through the cloud deck
    .fromTo('.c1', { scale: 0.5, opacity: 0, rotation: 0 }, { scale: 2.6, opacity: 1, rotation: 8, duration: 2.4, ease: 'power1.in' }, 5.2)
    .fromTo('.c2', { scale: 0.4, opacity: 0, rotation: 40 }, { scale: 2.2, opacity: 1, rotation: 30, duration: 2.2, ease: 'power1.in' }, 5.6)
    .fromTo('.c3', { scale: 0.35, opacity: 0, rotation: -60 }, { scale: 2.8, opacity: 1, rotation: -50, duration: 2, ease: 'power1.in' }, 6)
    .fromTo('.c4', { scale: 0.3, opacity: 0, rotation: 120 }, { scale: 3.2, opacity: 1, rotation: 130, duration: 1.8, ease: 'power1.in' }, 6.4)
    .to('.ship', { opacity: 0, duration: 0.8 }, 6.6)
    .to('.whiteout', { opacity: 1, duration: 1 }, 7.2)
}

/* ---------- clients ---------- */
function clients() {
  gsap.fromTo('.jet', { x: '25vw', y: '-6vh', rotation: -6 }, {
    x: '-95vw', y: '30vh', rotation: 4, ease: 'none',
    scrollTrigger: { trigger: '.clients', start: 'top bottom', end: 'bottom top', scrub: 0.8 },
  })
  $$('[data-fill]').forEach((h) => {
    if (h.closest('.port')) return
    gsap.fromTo($$('.dark', h), { color: '#8b9096' }, {
      color: '#0a0b0d', stagger: 0.2, ease: 'none',
      scrollTrigger: { trigger: h, start: 'top 80%', end: 'top 35%', scrub: true },
    })
  })
  $$('.quote').forEach((q) => {
    gsap.from(q.children, {
      opacity: 0, y: 50, stagger: 0.08, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: q, start: 'top 82%' },
    })
  })
}

/* ---------- footer ---------- */
function footer() {
  const eyebrow = $('.footer [data-scramble]')
  eyebrow.dataset.text = eyebrow.textContent
  ScrollTrigger.create({ trigger: '.footer', start: 'top 70%', once: true, onEnter: () => scramble(eyebrow) })
  gsap.from('.footer__mark', {
    yPercent: 40, opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '.footer__mark', start: 'top bottom', end: 'bottom bottom', scrub: true },
  })
}

intro()
port()
milestone()
ocean()
clients()
footer()

// Positions depend on images and fonts; recompute once they're in.
Promise.all([document.fonts.ready, ...$$('img').map((i) => (i.complete ? 0 : new Promise((r) => (i.onload = i.onerror = r))))]).then(() =>
  ScrollTrigger.refresh(),
)
