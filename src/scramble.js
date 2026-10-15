// Glitchy text reveal: characters resolve left to right out of block glyphs.
const GLYPHS = '▀▄█▌▐░▒▓■□▪▫-_=+/<>'

export function scramble(el, { duration = 900, delay = 0, reverse = false } = {}) {
  const text = el.dataset.text ?? el.textContent
  el.dataset.text = text
  const len = text.length
  const start = performance.now() + delay
  return new Promise((resolve) => {
    function tick(now) {
      const t = Math.max(0, now - start)
      const p = Math.min(1, t / duration)
      let out = ''
      for (let i = 0; i < len; i++) {
        const ch = text[i]
        const at = i / len
        const shown = reverse ? p < 1 - at : p > at * 0.8 + 0.1
        if (ch === ' ') out += ' '
        else if (shown) out += ch
        else if (reverse ? p > 1 - at - 0.15 : p > at * 0.8 - 0.1) out += GLYPHS[(Math.random() * GLYPHS.length) | 0]
        else out += reverse ? '' : ' '
      }
      el.textContent = out
      if (p < 1) requestAnimationFrame(tick)
      else {
        el.textContent = reverse ? '' : text
        resolve()
      }
    }
    requestAnimationFrame(tick)
  })
}

// Scroll-scrubbed version: progress 0..1 controls how much of the string is resolved.
export function scrambleAt(el, p) {
  const text = el.dataset.text ?? el.textContent
  el.dataset.text = text
  if (p >= 1) {
    if (el.textContent !== text) el.textContent = text
    return
  }
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const at = i / text.length
    if (ch === ' ') out += ' '
    else if (p > at + 0.08) out += ch
    else if (p > at - 0.12) out += GLYPHS[(Math.random() * GLYPHS.length) | 0]
    else out += ' '
  }
  el.textContent = out
}
