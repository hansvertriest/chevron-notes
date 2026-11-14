import { ref } from 'vue'
import type { Bounds, Point } from '../../layout'
import { lerp, tween } from '../motion/tween'

export interface Camera {
  x: number
  y: number
  /** Scale. */
  s: number
}

export interface Viewport {
  width: number
  height: number
}

const MIN_SCALE = 0.3
const MAX_SCALE = 2
/** Room kept free for the status line at the top and the command bar at the bottom; less on a phone. */
const insets = (width: number) => (width <= 640 ? { top: 40, bottom: 90, side: 16 } : { top: 44, bottom: 150, side: 70 })

/** Pan and zoom of the canvas: world point p is drawn at `p * s + (x, y)`. */
export function useCamera() {
  const camera = ref<Camera>({ x: 0, y: 0, s: 1 })
  const viewport = ref<Viewport>({ width: 0, height: 0 })
  let cancel = () => {}

  function set(c: Camera) {
    cancel()
    camera.value = c
  }

  function animateTo(to: Camera, duration = 560) {
    cancel()
    const from = { ...camera.value }
    cancel = tween(duration, (e) => {
      camera.value = { x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e), s: lerp(from.s, to.s, e) }
    })
  }

  /** The camera that shows `b` in the free part of the viewport. */
  function fitting(b: Bounds, maxScale = 1.05): Camera {
    const { width, height } = viewport.value
    const INSET = insets(width)
    const w = width - INSET.side * 2
    const h = height - INSET.top - INSET.bottom
    const s = Math.max(0.42, Math.min(w / (b.maxX - b.minX), h / (b.maxY - b.minY), maxScale))
    const cx = (b.minX + b.maxX) / 2
    const cy = (b.minY + b.maxY) / 2
    return { s, x: width / 2 - cx * s, y: INSET.top + h / 2 - cy * s }
  }

  /** Keeps the zoom and moves `p` to the middle of the free area. */
  function centring(p: Point): Camera {
    const { width, height } = viewport.value
    const INSET = insets(width)
    const s = camera.value.s
    return { s, x: width / 2 - p.x * s, y: INSET.top + (height - INSET.top - INSET.bottom) / 2 - p.y * s }
  }

  function panBy(dx: number, dy: number) {
    const c = camera.value
    set({ ...c, x: c.x + dx, y: c.y + dy })
  }

  /** Zooms around a screen point, so the point under the cursor stays put. */
  function zoomAt(sx: number, sy: number, factor: number) {
    const c = camera.value
    const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, c.s * factor))
    set({ s, x: sx - ((sx - c.x) * s) / c.s, y: sy - ((sy - c.y) * s) / c.s })
  }

  function toScreen(p: Point): Point {
    const c = camera.value
    return { x: p.x * c.s + c.x, y: p.y * c.s + c.y }
  }

  return { camera, viewport, set, animateTo, fitting, centring, panBy, zoomAt, toScreen }
}

export type CameraControls = ReturnType<typeof useCamera>
