/**
 * 로컬 개발에서 `GET/PUT /api/inventory`를 디스크 JSON으로 처리합니다.
 * `.env.local`에 `INVENTORY_SYNC_TOKEN`(또는 `VITE_INVENTORY_SYNC_TOKEN`)이 있을 때만 활성화됩니다.
 */
import { loadEnv } from 'vite'
import {
  readInventorySnapshotFromDisk,
  writeInventorySnapshotToDisk,
} from '../lib/inventoryFileApiLogic.js'

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
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export function inventoryFileApiPlugin() {
  return {
    name: 'tc-inv-inventory-file-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0] || ''
        if (pathname !== '/api/inventory') {
          next()
          return
        }

        const env = loadEnv(server.config.mode, process.cwd(), '')
        const token = String(env.INVENTORY_SYNC_TOKEN || env.VITE_INVENTORY_SYNC_TOKEN || '').trim()
        if (!token) {
          next()
          return
        }

        applyCors(res, req.headers.origin)

        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }

        const hdr = String(req.headers['x-tc-inv-sync-token'] || '').trim()
        if (hdr !== token) {
          res.statusCode = 401
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'unauthorized' }))
          return
        }

        if (req.method === 'GET') {
          try {
            const parsed = await readInventorySnapshotFromDisk()
            if (parsed == null) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, error: 'no_snapshot' }))
              return
            }
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(parsed))
          } catch (e) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
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
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, error: 'invalid_body' }))
              return
            }
            const { updatedAt } = await writeInventorySnapshotToDisk(body)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, updatedAt }))
          } catch (e) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }))
          }
          return
        }

        res.statusCode = 405
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }))
      })
    },
  }
}
