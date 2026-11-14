import { resolve } from 'node:path'
import { createApi } from './app.ts'
import { BoardFile } from './boardFile.ts'

const port = Number(process.env.CHEVRON_API_PORT ?? 5174)
const path = resolve(process.env.CHEVRON_BOARD_FILE ?? 'data/board.json')

createApi(new BoardFile(path)).listen(port, '127.0.0.1', () => {
  console.log(`chevron-notes API on http://127.0.0.1:${port} · board: ${path}`)
})
