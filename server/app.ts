import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { isBoardId, type BoardFolder } from './boardFolder.ts'

/**
 * The tiny local API. It stores the board JSON it is given and knows nothing
 * about the domain beyond a basic shape check; validation lives in the app.
 *
 *   GET    /api/health      → 200
 *   GET    /api/boards      → 200 [{ id, name, updatedAt }], most recent first
 *   GET    /api/boards/:id  → 200 board JSON, or 404
 *   PUT    /api/boards/:id  → 204 after the board is written (its `id` must match)
 *   DELETE /api/boards/:id  → 204, or 404
 *
 * Every response carries `X-Chevron-Api`, so the app can tell this API's
 * answers from a dev proxy's error page when the API isn't running.
 */

export const API_HEADER = 'X-Chevron-Api'

const MAX_BODY = 5 * 1024 * 1024

export function createApi(boards: BoardFolder): Server {
  return createServer((req, res) => {
    res.setHeader(API_HEADER, '1')
    handle(boards, req, res).catch((e: unknown) => {
      console.error(e)
      send(res, 500, { error: 'Internal error' })
    })
  })
}

async function handle(boards: BoardFolder, req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true })

  if (url.pathname === '/api/boards') {
    if (req.method !== 'GET') return notAllowed(res, 'GET')
    return send(res, 200, await boards.list())
  }

  const match = /^\/api\/boards\/([^/]+)$/.exec(url.pathname)
  if (!match) return send(res, 404, { error: 'Not found' })
  const id = decodeURIComponent(match[1]!)
  if (!isBoardId(id)) return send(res, 400, { error: 'Bad board id' })

  if (req.method === 'GET') {
    const json = await boards.read(id)
    if (json === null) return send(res, 404, { error: 'No such board' })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(json)
  }

  if (req.method === 'PUT') {
    const body = await readBody(req)
    if (body === null) return send(res, 413, { error: 'Board too large' })
    let data: unknown
    try {
      data = JSON.parse(body)
    } catch {
      return send(res, 400, { error: 'Invalid JSON' })
    }
    if (typeof data !== 'object' || data === null || typeof (data as { schemaVersion?: unknown }).schemaVersion !== 'number')
      return send(res, 400, { error: 'Not a board' })
    if ((data as { id?: unknown }).id !== id) return send(res, 400, { error: 'Board id does not match the URL' })
    await boards.write(id, JSON.stringify(data, null, 2) + '\n')
    res.writeHead(204)
    return res.end()
  }

  if (req.method === 'DELETE') {
    if (!(await boards.remove(id))) return send(res, 404, { error: 'No such board' })
    res.writeHead(204)
    return res.end()
  }

  notAllowed(res, 'GET, PUT, DELETE')
}

function notAllowed(res: ServerResponse, allow: string) {
  res.setHeader('Allow', allow)
  send(res, 405, { error: 'Method not allowed' })
}

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) {
        resolve(null)
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}
