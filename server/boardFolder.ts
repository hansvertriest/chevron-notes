import { mkdir, readdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { BoardFile } from './boardFile.ts'

/** What the board list shows, without loading every note. */
export interface BoardSummary {
  id: string
  name: string
  updatedAt: string
}

/** Board ids become file names, so only these characters get through. */
const ID = /^[A-Za-z0-9_-]{1,64}$/

export const isBoardId = (id: string) => ID.test(id)

/**
 * All boards, one JSON file each: `<dir>/<id>.json`. Each file is written
 * through its own `BoardFile`, so saves to one board never wait on another.
 */
export class BoardFolder {
  private readonly files = new Map<string, BoardFile>()

  readonly dir: string

  constructor(dir: string) {
    this.dir = dir
  }

  private file(id: string): BoardFile {
    if (!isBoardId(id)) throw new Error(`Bad board id: ${id}`)
    let f = this.files.get(id)
    if (!f) this.files.set(id, (f = new BoardFile(join(this.dir, `${id}.json`))))
    return f
  }

  /** Every board, most recently changed first. Unreadable files are skipped. */
  async list(): Promise<BoardSummary[]> {
    let names: string[]
    try {
      names = await readdir(this.dir)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw e
    }
    const out: BoardSummary[] = []
    for (const name of names) {
      const id = name.endsWith('.json') ? name.slice(0, -5) : ''
      if (!isBoardId(id)) continue
      const path = join(this.dir, name)
      try {
        const data = JSON.parse(await readFile(path, 'utf8')) as { name?: unknown }
        const { mtime } = await stat(path)
        out.push({ id, name: typeof data.name === 'string' ? data.name : 'Untitled', updatedAt: mtime.toISOString() })
      } catch {
        // A half-edited or foreign file is not a board; leave it alone.
      }
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  read(id: string): Promise<string | null> {
    return this.file(id).read()
  }

  write(id: string, json: string): Promise<void> {
    return this.file(id).write(json)
  }

  /** True when there was a board to delete. */
  async remove(id: string): Promise<boolean> {
    const f = this.file(id)
    if ((await f.read()) === null) return false
    await rm(f.path, { force: true })
    return true
  }

  /**
   * Moves the single-board file of earlier versions into the folder, named
   * after the board's id. Does nothing when there is no such file.
   */
  async adopt(legacyPath: string): Promise<string | null> {
    let json: string
    try {
      json = await readFile(legacyPath, 'utf8')
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw e
    }
    const id = (JSON.parse(json) as { id?: unknown }).id
    if (typeof id !== 'string' || !isBoardId(id)) throw new Error(`${legacyPath} has no usable board id`)
    await mkdir(this.dir, { recursive: true })
    await rename(legacyPath, join(this.dir, `${id}.json`))
    return id
  }
}
