import { join, resolve } from 'node:path'
import { createApi } from './app.ts'
import { BoardFolder } from './boardFolder.ts'

const port = Number(process.env.CHEVRON_API_PORT ?? 5174)
const dataDir = resolve(process.env.CHEVRON_DATA_DIR ?? 'data')
const boards = new BoardFolder(join(dataDir, 'boards'))

// Earlier versions kept a single board in data/board.json.
const adopted = await boards.adopt(join(dataDir, 'board.json'))
if (adopted) console.log(`Moved data/board.json to ${join(boards.dir, `${adopted}.json`)}`)

createApi(boards).listen(port, '127.0.0.1', () => {
  console.log(`chevron-notes API on http://127.0.0.1:${port} · boards: ${boards.dir}`)
})
