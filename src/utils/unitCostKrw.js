/** Model + Part 기준 대당 원가(KRW) — Settings에서만 관리 */

export function skuCostKey(modelName, partNo) {
  return `${modelName ?? ''}\t${partNo ?? ''}`
}

/** @param {Record<string, number> | null | undefined} unitCostKrwBySku */
export function getUnitCostKrw(unitCostKrwBySku, modelName, partNo) {
  if (!unitCostKrwBySku || typeof unitCostKrwBySku !== 'object') return 0
  const v = unitCostKrwBySku[skuCostKey(modelName, partNo)]
  return Math.max(0, Number(v) || 0)
}

/** 천 단위 구분 숫자만 (통화 접두사 없음) */
export function formatKrwInteger(n) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(Number(n) || 0))
}

/** 대시보드 등 한 줄 원화: "₩ 1,234,567" */
export function formatKrwWon(n) {
  return `₩ ${formatKrwInteger(n)}`
}

/** @deprecated 숫자만 필요하면 formatKrwInteger, 한 줄 표기는 formatKrwWon 사용 */
export function formatKrwTotal(n) {
  return formatKrwInteger(n)
}
