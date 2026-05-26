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

/** 대시보드용 KRW 총액 표기 (단가 미표시) */
export function formatKrwTotal(n) {
  const v = Math.round(Number(n) || 0)
  const fmt = new Intl.NumberFormat('ko-KR').format(v)
  return `KRW ${fmt}`
}
