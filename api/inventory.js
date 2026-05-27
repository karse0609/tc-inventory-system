import { Redis } from '@upstash/redis'

const SNAPSHOT_KEY = 'tc-inv:snapshot:v1'

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

/** 모바일·다른 서브도메인에서 API를 부를 때를 대비한 CORS (토큰 헤더 preflight 허용) */
function applyCors(req, res) {
  const origin = req.headers?.origin
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
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

function parseJsonBody(req) {
  const raw = req.body
  if (raw == null) return null
  if (typeof raw === 'object') return raw
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw || '{}')
    } catch {
      return null
    }
  }
  return null
}

export default async function handler(req, res) {
  applyCors(req, res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const sync = req.headers['x-tc-inv-sync-token']
  if (!sync || sync !== process.env.INVENTORY_SYNC_TOKEN) {
    console.warn('[tc-inv api]', req.method, 401, 'unauthorized', {
      hasHeader: !!req.headers['x-tc-inv-sync-token'],
    })
    res.status(401).json({ ok: false, error: 'unauthorized' })
    return
  }

  const redis = getRedis()
  if (!redis) {
    console.error('[tc-inv api]', req.method, 503, 'redis_not_configured')
    res.status(503).json({ ok: false, error: 'redis_not_configured' })
    return
  }

  if (req.method === 'GET') {
    try {
      const raw = await redis.get(SNAPSHOT_KEY)
      if (raw == null || raw === '') {
        console.log('[tc-inv api]', 'GET', 404, 'no_snapshot')
        res.status(404).json({ ok: false, error: 'no_snapshot' })
        return
      }
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      const payload = parsed?.payload
      const rows =
        payload && typeof payload === 'object' && Array.isArray(payload['tc-inv-in-transit'])
          ? payload['tc-inv-in-transit'].length
          : undefined
      console.log('[tc-inv api]', 'GET', 200, 'snapshot', {
        updatedAt: parsed?.updatedAt,
        inTransitRows: rows,
      })
      res.status(200).json(parsed)
    } catch (e) {
      console.error('[tc-inv api]', 'GET', 500, String(e?.message || e))
      res.status(500).json({ ok: false, error: String(e?.message || e) })
    }
    return
  }

  if (req.method === 'PUT') {
    try {
      const body = parseJsonBody(req)
      if (!body || typeof body !== 'object') {
        console.warn('[tc-inv api]', 'PUT', 400, 'invalid_body', {
          bodyType: typeof req.body,
        })
        res.status(400).json({ ok: false, error: 'invalid_body' })
        return
      }
      const envelope = {
        ...body,
        updatedAt: new Date().toISOString(),
      }
      const json = JSON.stringify(envelope)
      await redis.set(SNAPSHOT_KEY, json)
      console.log('[tc-inv api]', 'PUT', 200, 'saved', {
        updatedAt: envelope.updatedAt,
        bytes: json.length,
      })
      res.status(200).json({ ok: true, updatedAt: envelope.updatedAt })
    } catch (e) {
      console.error('[tc-inv api]', 'PUT', 500, String(e?.message || e))
      res.status(500).json({ ok: false, error: String(e?.message || e) })
    }
    return
  }

  res.status(405).json({ ok: false, error: 'method_not_allowed' })
}
