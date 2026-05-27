const KEYS = {
  master: 'tc-inv-master-items',
  plans: 'tc-inv-delivery-plans',
  transit: 'tc-inv-in-transit',
  ops: 'tc-inv-operations-meta',
  weekly: 'tc-inv-weekly-plans',
  starting: 'tc-inv-starting-inventory',
  simSource: 'tc-inv-sim-source',
  /** 관리자 전용: SKU별 대당 원가(KRW) */
  unitCostsKrw: 'tc-inv-unit-cost-krw-by-sku',
  /** 운송중 입고 확정 이력(기준일 역산용) */
  arrivalLedger: 'tc-inv-arrival-ledger',
  /** 입고 취소 감사 로그(대시보드·추적 연동용) */
  receiptCancelLedger: 'tc-inv-receipt-cancel-ledger',
}

export function loadJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota */
  }
}

export const storageKeys = KEYS
