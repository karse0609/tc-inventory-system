/** 운송중 행 상태 (UI·집계 공통) */

export const TRANSIT_ROW_STATUS = /** @type {const} */ ({
  IN_TRANSIT: '운송중',
  RECEIVED: '입고완료',
})

/** localStorage·레거시 데이터에서 id 타입이 달라도 동일 행으로 매칭 */
export function transitRowIdKey(id) {
  return String(id ?? '')
}

/** @param {unknown} s */
export function normalizeTransitStatus(s) {
  return s === TRANSIT_ROW_STATUS.RECEIVED ? TRANSIT_ROW_STATUS.RECEIVED : TRANSIT_ROW_STATUS.IN_TRANSIT
}

/** @param {object | null | undefined} row */
export function isTransitRowReceived(row) {
  return row?.transitStatus === TRANSIT_ROW_STATUS.RECEIVED
}
