import { onBeforeUnmount, ref, type Ref } from 'vue'

/**
 * Small-screen helpers.
 *
 * `trackVisualViewport` keeps `--app-height` and `--app-top` on <html> equal
 * to the visible part of the page. On phones and tablets the on-screen
 * keyboard shrinks that part without resizing the page, so the app (sized
 * from these variables in theme.css) shrinks with it and the command bar
 * stays right above the keyboard.
 */
export function trackVisualViewport() {
  const vv = window.visualViewport
  if (!vv) return
  const root = document.documentElement
  const sync = () => {
    root.style.setProperty('--app-height', `${vv.height}px`)
    root.style.setProperty('--app-top', `${vv.offsetTop}px`)
  }
  vv.addEventListener('resize', sync)
  vv.addEventListener('scroll', sync)
  sync()
}

/** A mouse or trackpad, as opposed to a finger: worth focusing inputs eagerly. */
export const hasFinePointer = () => typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches

/** Whether a media query matches, kept up to date while the component lives. */
export function useMediaQuery(query: string): Ref<boolean> {
  const mq = typeof matchMedia === 'function' ? matchMedia(query) : null
  const matches = ref(mq?.matches ?? false)
  const update = () => (matches.value = mq?.matches ?? false)
  mq?.addEventListener('change', update)
  onBeforeUnmount(() => mq?.removeEventListener('change', update))
  return matches
}
