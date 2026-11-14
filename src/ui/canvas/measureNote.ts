import type { Size } from '../../layout'

/**
 * Measures how big a note's box must be to show all of its text: one line
 * as wide as the text, wrapping at the `.note-box` max width. Measured in
 * the DOM with the same `.note-box` CSS the canvas draws with, so the layout
 * and the drawn boxes agree. Results are cached per text and weight.
 */

const cache = new Map<string, Size>()
let probe: HTMLDivElement | null = null

function getProbe(): HTMLDivElement {
  if (probe?.isConnected) return probe
  probe = document.createElement('div')
  probe.className = 'note-box'
  probe.setAttribute('aria-hidden', 'true')
  Object.assign(probe.style, { position: 'absolute', left: '-10000px', top: '0', visibility: 'hidden', width: 'max-content' })
  document.body.appendChild(probe)
  return probe
}

export function measureNote(text: string, bold: boolean): Size {
  const key = `${bold ? 'b' : 'n'}|${text}`
  const hit = cache.get(key)
  if (hit) return hit
  const el = getProbe()
  el.classList.toggle('bold', bold)
  el.textContent = text
  const rect = el.getBoundingClientRect()
  const size = { width: Math.ceil(rect.width), height: Math.ceil(rect.height) }
  cache.set(key, size)
  return size
}
