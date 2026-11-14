import { shallowRef, watch, type Ref } from 'vue'
import type { Point } from '../../layout'
import { lerp, tween } from './tween'

/**
 * Follows a layout with a tween, so the board re-flows instead of jumping.
 * Nodes that are new start at their target (they pop in with CSS).
 */
export function useAnimatedPositions(target: Ref<Record<string, Point>>, duration = 560) {
  const shown = shallowRef<Record<string, Point>>({ ...target.value })
  let cancel = () => {}

  watch(target, (to) => {
    cancel()
    const from = shown.value
    cancel = tween(duration, (e) => {
      const next: Record<string, Point> = {}
      for (const [id, p] of Object.entries(to)) {
        const f = from[id] ?? p
        next[id] = { x: lerp(f.x, p.x, e), y: lerp(f.y, p.y, e) }
      }
      shown.value = next
    })
  })

  return shown
}
