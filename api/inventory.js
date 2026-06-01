/**
 * 클라우드 재고 동기화 API — v2.0에서 Upstash Redis 연동 재개 예정.
 * 현재는 Redis·로컬 디스크 모두 사용하지 않으며, 503으로 비활성 상태만 알립니다.
 */

/** 모바일·다른 오리진에서 API를 부를 때를 대비한 CORS (토큰 헤더 preflight 허용) */
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

export default async function handler(req, res) {
  applyCors(req, res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  res.setHeader('Cache-Control', 'no-store')
  res.status(503).json({ ok: false, error: 'cloud_sync_disabled' })
}
