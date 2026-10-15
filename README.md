# Kestrel Freightworks — scroll-driven logistics concept

Portfolio piece: a scroll-animated landing page for a fictional APAC freight company.

- 3D dotted globe hero with flight arcs (Three.js, custom shaders)
- Pinned port scene: reach stacker loads a container onto a truck, camera tilts top-down, truck follows the road
- Split panels open onto an ocean scene, container ship zoom, climb through clouds
- Testimonials with a jet fly-over

Stack: Vite, vanilla JS, Three.js, GSAP ScrollTrigger, Lenis. Imagery generated with Gemini.

```bash
npm install
npm run dev     # http://localhost:5173 (also on LAN)
npm run build
```

`tools/cutout.py` removes flat white/black studio backgrounds from generated renders.
