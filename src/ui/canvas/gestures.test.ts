import { describe, expect, it } from 'vitest'
import { pinchStep } from './gestures'

describe('pinchStep', () => {
  it('zooms by the change in finger distance, around the new midpoint', () => {
    const s = pinchStep(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      [
        { x: -50, y: 0 },
        { x: 150, y: 0 },
      ],
    )
    expect(s).toEqual({ factor: 2, mid: { x: 50, y: 0 }, pan: { x: 0, y: 0 } })
  })

  it('pans when both fingers move together', () => {
    const s = pinchStep(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      [
        { x: 10, y: 20 },
        { x: 110, y: 20 },
      ],
    )
    expect(s.factor).toBe(1)
    expect(s.pan).toEqual({ x: 10, y: 20 })
  })

  it('does not divide by zero when the fingers start on one spot', () => {
    expect(pinchStep([{ x: 5, y: 5 }, { x: 5, y: 5 }], [{ x: 0, y: 5 }, { x: 10, y: 5 }]).factor).toBe(1)
  })
})
