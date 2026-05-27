/** 원격 재고 동기화 디버그 (모바일 Safari 등에서 콘솔로 추적) */

export const REMOTE_SYNC_LOG_PREFIX = '[tc-inv sync]'

/** 상세 fetch/본문 일부 로그 (VITE_DEBUG_REMOTE_SYNC=true) */
export function remoteSyncVerbose() {
  return import.meta.env.VITE_DEBUG_REMOTE_SYNC === 'true'
}

/**
 * @param {string} event
 * @param {Record<string, unknown>} [data]
 */
export function logRemoteSync(event, data) {
  if (data && Object.keys(data).length) {
    console.log(REMOTE_SYNC_LOG_PREFIX, event, data)
  } else {
    console.log(REMOTE_SYNC_LOG_PREFIX, event)
  }
}
