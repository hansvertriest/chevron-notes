import { ref, type Ref } from 'vue'
import type { Point } from '../../layout'
import type { CameraControls } from './useCamera'

/**
 * Pan and zoom by pointer, for mouse, pen and touch alike:
 *
 * - one pointer drags the canvas, starting anywhere, on notes too;
 * - two pointers pinch: zoom around their midpoint and follow it;
 * - the wheel (and a trackpad pinch) zooms around the cursor.
 *
 * A drag only starts after the pointer moves a few pixels, so a tap on a
 * note still opens it; the click that ends a real drag is swallowed.
 */

const DRAG_THRESHOLD = 6

export interface PinchStep {
  /** Zoom factor since the last step. */
  factor: number
  /** Midpoint now, around which to zoom. */
  mid: Point
  /** How far the midpoint moved. */
  pan: Point
}

export function pinchStep(before: [Point, Point], after: [Point, Point]): PinchStep {
  const dist = ([a, b]: [Point, Point]) => Math.hypot(b.x - a.x, b.y - a.y)
  const mid = ([a, b]: [Point, Point]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const m0 = mid(before)
  const m1 = mid(after)
  const d0 = dist(before)
  return { factor: d0 > 0 ? dist(after) / d0 : 1, mid: m1, pan: { x: m1.x - m0.x, y: m1.y - m0.y } }
}

export function useCanvasGestures(frame: Ref<HTMLElement | undefined>, cam: CameraControls, onBackgroundDown: () => void) {
  const pointers = new Map<number, Point>()
  const dragging = ref(false)
  let start: Point | null = null
  let swallowClick = false

  /** Capturing can fail when the pointer is already gone; panning works without it. */
  const capture = (id: number) => {
    try {
      frame.value?.setPointerCapture(id)
    } catch {
      /* ignore */
    }
  }

  const local = (e: PointerEvent | WheelEvent): Point => {
    const r = frame.value!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const t = e.target as Element
    // Popovers and other overlays inside the frame handle their own pointers.
    if (t.closest('input, select, textarea, button')) return
    if (!t.closest('.note, .label') && !t.classList.contains('hit')) onBackgroundDown()
    pointers.set(e.pointerId, local(e))
    if (pointers.size === 1) {
      start = local(e)
      swallowClick = false
    } else {
      // A second finger: it's a pinch now, whatever the first one was on.
      dragging.value = true
      swallowClick = true
      for (const id of pointers.keys()) capture(id)
    }
  }

  function onPointerMove(e: PointerEvent) {
    const prev = pointers.get(e.pointerId)
    if (!prev) return
    const now = local(e)

    if (pointers.size >= 2) {
      const [a, b] = [...pointers.keys()]
      const other = pointers.get(a === e.pointerId ? b! : a!)!
      const step = pinchStep([prev, other], [now, other])
      pointers.set(e.pointerId, now)
      cam.panBy(step.pan.x, step.pan.y)
      cam.zoomAt(step.mid.x, step.mid.y, step.factor)
      return
    }

    if (!dragging.value) {
      if (!start || Math.hypot(now.x - start.x, now.y - start.y) < DRAG_THRESHOLD) return
      dragging.value = true
      swallowClick = true
      capture(e.pointerId)
    }
    pointers.set(e.pointerId, now)
    cam.panBy(now.x - prev.x, now.y - prev.y)
  }

  function onPointerUp(e: PointerEvent) {
    pointers.delete(e.pointerId)
    if (pointers.size === 1) {
      // One finger left after a pinch: carry on panning from where it is.
      start = [...pointers.values()][0]!
      return
    }
    if (pointers.size === 0) {
      dragging.value = false
      start = null
    }
  }

  /** In the capture phase: a drag that ended on a note must not open it. */
  function onClickCapture(e: MouseEvent) {
    if (!swallowClick) return
    swallowClick = false
    e.stopPropagation()
    e.preventDefault()
  }

  function onWheel(e: WheelEvent) {
    const p = local(e)
    // Trackpad pinch arrives as a wheel event with ctrlKey and small deltas.
    const speed = e.ctrlKey ? 0.01 : 0.0015
    cam.zoomAt(p.x, p.y, Math.exp(-e.deltaY * speed))
  }

  return { dragging, onPointerDown, onPointerMove, onPointerUp, onClickCapture, onWheel }
}
