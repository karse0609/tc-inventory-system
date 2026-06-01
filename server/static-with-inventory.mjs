/**
 * 프로덕션: `dist` 정적 호스팅 + 디스크 JSON 기반 `GET/PUT /api/inventory`
 * 사용: npm run build && npm run start
 */
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  readInventorySnapshotFromDisk,
  writeInventorySnapshotToDisk,
} from '../lib/inventoryFileApiLogic.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')
const distDir = join(root, 'dist')

function applyCors(res, originHeader) {
  if (originHeader) {
    res.setHeader('Access-Control-Allow-Origin', originHeader)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*')
  }
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, x-tc-inv-sync-token, Cache-Control, Pragma',
  )
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

async function serveStatic(urlPath, res) {
  if (!existsSync(distDir)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('dist/ not found — run npm run build first')
    return
  }
  const rootResolved = resolve(distDir) + sep
  const rel = urlPath === '/' || urlPath === '' ? 'index.html' : urlPath.replace(/^\//, '')
  let filePath = resolve(join(distDir, rel))
  if (!filePath.startsWith(rootResolved)) {
    res.writeHead(403).end()
    return
  }
  if (!existsSync(filePath)) {
    const idx = join(distDir, 'index.html')
    if (existsSync(idx) && !extname(rel)) filePath = idx
    else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
    }
  } else {
    try {
      if ((await stat(filePath)).isDirectory()) {
        const idx = join(filePath, 'index.html')
        filePath = existsSync(idx) ? idx : join(distDir, 'index.html')
      }
    } catch {
      const idx = join(distDir, 'index.html')
      filePath = existsSync(idx) ? idx : filePath
    }
  }
  const ext = extname(filePath)
  const type = MIME[ext] || 'application/octet-stream'
  const buf = await readFile(filePath)
  res.writeHead(200, { 'Content-Type': type })
  res.end(buf)
}

async function handleInventory(req, res) {
  applyCors(res, req.headers.origin)

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end()
    return
  }

  const expected = String(process.env.INVENTORY_SYNC_TOKEN || '').trim()
  if (!expected) {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: 'INVENTORY_SYNC_TOKEN not set' }))
    return
  }

  const hdr = String(req.headers['x-tc-inv-sync-token'] || '').trim()
  if (hdr !== expected) {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: 'unauthorized' }))
    return
  }

  if (req.method === 'GET') {
    try {
      const parsed = await readInventorySnapshotFromDisk()
      if (parsed == null) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, error: 'no_snapshot' }))
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(parsed))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }))
    }
    return
  }

  if (req.method === 'PUT') {
    try {
      const raw = await readBody(req)
      let body
      try {
        body = raw ? JSON.parse(raw) : null
      } catch {
        body = null
      }
      if (!body || typeof body !== 'object') {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, error: 'invalid_body' }))
        return
      }
      const { updatedAt } = await writeInventorySnapshotToDisk(body)
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: true, updatedAt }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }))
    }
    return
  }

  res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }))
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    if (url.pathname === '/api/inventory') {
      await handleInventory(req, res)
      return
    }
    await serveStatic(url.pathname, res)
  } catch (e) {
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(String(e?.message || e))
  }
})

const port = Number(process.env.PORT || 8787)
server.listen(port, () => {
  console.log(`[tc-inv] serving dist/ + /api/inventory on http://127.0.0.1:${port}`)
  console.log(`[tc-inv] snapshot file: ${process.env.INVENTORY_SNAPSHOT_FILE || join(process.cwd(), 'data', 'live-inventory.json')}`)
})
