import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/**
 * The board as one JSON file. Writes go to a temporary file first and are
 * renamed over the old one, so a crash never leaves half a board behind.
 * Writes are queued so two saves can't interleave.
 */
export class BoardFile {
  private queue: Promise<unknown> = Promise.resolve()

  readonly path: string

  constructor(path: string) {
    this.path = path
  }

  /** The stored JSON text, or null when there is no board yet. */
  async read(): Promise<string | null> {
    try {
      return await readFile(this.path, 'utf8')
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw e
    }
  }

  write(json: string): Promise<void> {
    const run = async () => {
      await mkdir(dirname(this.path), { recursive: true })
      const tmp = `${this.path}.${process.pid}.tmp`
      await writeFile(tmp, json, 'utf8')
      await rename(tmp, this.path)
    }
    const next = this.queue.then(run, run)
    this.queue = next.catch(() => {})
    return next
  }
}
