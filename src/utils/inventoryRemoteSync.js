/** @typedef {{ ok?: boolean, error?: string, updatedAt?: string }} RemotePutResult */
/** (요청 파일명 혼동 방지) TypeScript가 아닌 이 모듈이 클라이언트 fetch를 담당합니다. */

import { logRemoteSync, remoteSyncVerbose, REMOTE_SYNC_LOG_PREFIX } from './remoteSyncDebug.js'

const META_KEY = 'tc-inv-remote-meta'

/** 원격 재고 API fetch 타임아웃 (체크포인트·망 끊김에서 부트스트랩이 무한 대기하지 않도록) */
const REMOTE_FETCH_TIMEOUT_MS = 15000

/**
 * 클라우드 재고 스냅샷 API 사용 여부 (v2.0까지 기본 OFF).
 * - `VITE_INVENTORY_SYNC_TOKEN` 이 있고
 * - `VITE_INVENTORY_REMOTE_SYNC` 가 대소문자 무관 `"true"` 일 때만 ON.
 * - 베타·안정화 빌드는 `vercel.json` / Vercel 환경 변수로 REMOTE 를 false 로 두면 API를 호출하지 않습니다.
 */
export function inventoryRemoteSyncEnabled() {
  const token = String(import.meta.env.VITE_INVENTORY_SYNC_TOKEN || '').trim()
  if (!token) return false
  const flag = String(import.meta.env.VITE_INVENTORY_REMOTE_SYNC || '').trim().toLowerCase()
  return flag === 'true'
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
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS)
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
      signal: controller.signal,
      body: jsonBody != null ? JSON.stringify(jsonBody) : undefined,
    })
  } catch (err) {
    const msErr = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
    const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : 'Error'
    const message = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err)
    console.error(REMOTE_SYNC_LOG_PREFIX, 'fetch:network-error', {
      method,
      url,
      ms: Math.round(msErr),
      name,
      message,
      hint: 'Safari: VPN/Private Relay/기업망에서 차단되면 TypeError: Load failed 가 흔합니다.',
    })
    const aborted = name === 'AbortError'
    return {
      ok: false,
      error: aborted ? 'timeout' : `network:${name}:${message}`,
      status: 0,
    }
  } finally {
    clearTimeout(timeoutId)
  }
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  /** 200 + HTML(예: 보안 체크포인트)이면 JSON이 아니므로 실패로 취급 */
  if (res.ok && data && typeof data === 'object' && 'raw' in data) {
    return {
      ok: false,
      status: res.status,
      error: 'non_json_response',
      data,
    }
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
