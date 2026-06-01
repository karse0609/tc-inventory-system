/** @typedef {{ ok?: boolean, error?: string, updatedAt?: string }} RemotePutResult */
/** (요청 파일명 혼동 방지) TypeScript가 아닌 이 모듈이 클라이언트 fetch를 담당합니다. */

import { logRemoteSync, remoteSyncVerbose, REMOTE_SYNC_LOG_PREFIX } from './remoteSyncDebug.js'

const META_KEY = 'tc-inv-remote-meta'

/**
 * 클라우드 재고 스냅샷 API 사용 여부.
 * - 빌드에 `VITE_INVENTORY_SYNC_TOKEN` 이 비어 있지 않으면 ON (VITE_INVENTORY_REMOTE_SYNC 값과 무관).
 *   Vercel에서 REMOTE 플래그를 false로 둔 경우에도 모바일 Refresh·PC pull이 동작하도록 함.
 * - 토큰이 없으면 OFF(로컬 전용).
 */
export function inventoryRemoteSyncEnabled() {
  return !!String(import.meta.env.VITE_INVENTORY_SYNC_TOKEN || '').trim()
}

export function buildInventoryRemoteUrl() {
  const base = import.meta.env.BASE_URL || '/'
  const root = `${window.location.origin}${base === '/' ? '' : base.replace(/\/$/, '')}`
  return `${root}/api/inventory`
}

export function readRemoteMeta() {
  try {
    const raw = localStorage.getItem(META_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function writeRemoteMeta(patch) {
  try {
    const prev = readRemoteMeta()
    localStorage.setItem(META_KEY, JSON.stringify({ ...prev, ...patch }))
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} method
 * @param {object | undefined} jsonBody
 */
export async function inventoryRemoteRequest(method, jsonBody) {
  if (!inventoryRemoteSyncEnabled()) {
    logRemoteSync('fetch:skipped', { reason: 'remote_disabled', method })
    return { ok: false, error: 'remote_disabled' }
  }
  const url = buildInventoryRemoteUrl()
  let fetchMode = 'cors'
  try {
    const u = new URL(url, window.location.href)
    if (u.origin === window.location.origin) fetchMode = 'same-origin'
  } catch {
    /* ignore */
  }
  const tokenPresent = !!String(import.meta.env.VITE_INVENTORY_SYNC_TOKEN || '').trim()
  const headers = {
    'Content-Type': 'application/json',
    'x-tc-inv-sync-token': String(import.meta.env.VITE_INVENTORY_SYNC_TOKEN || '').trim(),
  }
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
  logRemoteSync('fetch:request', {
    method,
    url,
    fetchMode,
    credentials: 'same-origin',
    tokenHeaderPresent: tokenPresent,
    bodyBytes: jsonBody != null ? JSON.stringify(jsonBody).length : 0,
  })
  let res
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...headers,
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
      credentials: 'same-origin',
      mode: fetchMode,
      body: jsonBody != null ? JSON.stringify(jsonBody) : undefined,
    })
  } catch (err) {
    const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
    const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : 'Error'
    const message = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err)
    console.error(REMOTE_SYNC_LOG_PREFIX, 'fetch:network-error', {
      method,
      url,
      ms: Math.round(ms),
      name,
      message,
      hint: 'Safari: VPN/Private Relay/기업망에서 차단되면 TypeError: Load failed 가 흔합니다.',
    })
    return { ok: false, error: `network:${name}:${message}`, status: 0 }
  }
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  const bodyPreview =
    remoteSyncVerbose() && text
      ? String(text).slice(0, 400) + (String(text).length > 400 ? '…' : '')
      : undefined
  logRemoteSync('fetch:response', {
    method,
    url,
    httpStatus: res.status,
    ok: res.ok,
    ms: Math.round(ms),
    bodyChars: text.length,
    jsonParsed: !(data && typeof data === 'object' && 'raw' in data),
    corsOrigin: res.headers.get('Access-Control-Allow-Origin') || '(none or same-origin)',
    ...(bodyPreview ? { bodyPreview } : {}),
  })
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: data?.error || data?.raw || res.statusText,
      data,
    }
  }
  return { ok: true, status: res.status, data }
}
