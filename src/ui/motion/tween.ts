export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Calls `frame` with an eased 0..1 progress until done. Returns a cancel function. */
export function tween(duration: number, frame: (e: number) => void): () => void {
  if (duration <= 0 || prefersReducedMotion()) {
    frame(1)
    return () => {}
  }
  const t0 = performance.now()
  let raf = 0
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / duration)
    frame(easeOutCubic(t))
    if (t < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
  return () => cancelAnimationFrame(raf)
}

export const lerp = (a: number, b: number, e: number) => a + (b - a) * e
