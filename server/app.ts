import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { BoardFile } from './boardFile.ts'

/**
 * The tiny local API. It stores the board JSON it is given and knows nothing
 * about the domain beyond a basic shape check; validation lives in the app.
 *
 *   GET  /api/health  → 200
 *   GET  /api/board   → 200 board JSON, or 404 when there is none yet
 *   PUT  /api/board   → 204 after the board is written
 *
 * Every response carries `X-Chevron-Api`, so the app can tell this API's
 * answers from a dev proxy's error page when the API isn't running.
 */

export const API_HEADER = 'X-Chevron-Api'

const MAX_BODY = 5 * 1024 * 1024

export function createApi(file: BoardFile): Server {
  return createServer((req, res) => {
    res.setHeader(API_HEADER, '1')
    handle(file, req, res).catch((e: unknown) => {
      console.error(e)
      send(res, 500, { error: 'Internal error' })
    })
  })
}

async function handle(file: BoardFile, req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true })
  if (url.pathname !== '/api/board') return send(res, 404, { error: 'Not found' })

  if (req.method === 'GET') {
    const json = await file.read()
    if (json === null) return send(res, 404, { error: 'No board yet' })
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
    await file.write(JSON.stringify(data, null, 2) + '\n')
    res.writeHead(204)
    return res.end()
  }

  res.setHeader('Allow', 'GET, PUT')
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
