import type { Size } from '../../layout'

/**
 * Measures text in the DOM with the same CSS the canvas draws it with, so
 * the layout and what's drawn agree. Results are cached.
 *
 * - `measureNote`: a note's box (`.note-box`): one line as wide as the text,
 *   wrapping at the max width.
 * - `measureLabel`: the width of a relation label (`.edge-label`), which the
 *   layout reserves room for.
 */

const cache = new Map<string, Size>()
const probes = new Map<string, HTMLDivElement>()

function measure(className: string, text: string): Size {
  const key = `${className}|${text}`
  const hit = cache.get(key)
  if (hit) return hit
  let el = probes.get(className)
  if (!el?.isConnected) {
    el = document.createElement('div')
    el.className = className
    el.setAttribute('aria-hidden', 'true')
    Object.assign(el.style, { position: 'absolute', left: '-10000px', top: '0', visibility: 'hidden', width: 'max-content' })
    document.body.appendChild(el)
    probes.set(className, el)
  }
  el.textContent = text
  const rect = el.getBoundingClientRect()
  const size = { width: Math.ceil(rect.width), height: Math.ceil(rect.height) }
  cache.set(key, size)
  return size
}

export function measureNote(text: string, bold: boolean): Size {
  return measure(bold ? 'note-box bold' : 'note-box', text)
}

export function measureLabel(text: string): number {
  return measure('edge-label', text).width
}
