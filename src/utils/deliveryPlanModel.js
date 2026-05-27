import { planWeekMonday } from './deliveryPlanHorizon'

/** 주차 셀 계획 수량 (qty / planQty / plannedQty 호환) */
export function planQty(p) {
  if (!p || typeof p !== 'object') return 0
  const raw = p.planQty != null ? p.planQty : p.qty ?? p.plannedQty
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

export function isPlanShipped(p) {
  return p?.shipped === true
}

/**
 * 재고 예측·역산용 출고 분량: 확정(창고 차감 반영됨)인 주차는 0으로 두어 이중 차감 방지
 */
export function outboundQtyForSimulation(p) {
  if (isPlanShipped(p)) return 0
  return planQty(p)
}

export function deliveryPlanCellKey(p) {
  const mon = planWeekMonday(p)
  if (!mon || !p.modelName || !p.partNo) return ''
  return `${p.modelName}\t${p.partNo}\t${mon}`
}

/**
 * 이전 저장본 vs 저장 예정본 비교 → SKU(모델+품번)별 창고 조정량 (+복원, −추가 차감)
 * @param {object[]} prevPlans
 * @param {object[]} nextPlans
 * @returns {Map<string, number>} key = modelName\tpartNo
 */
export function computeStockDeltasBySku(prevPlans, nextPlans) {
  const prevM = new Map()
  const nextM = new Map()
  for (const p of prevPlans || []) {
    const k = deliveryPlanCellKey(p)
    if (k) prevM.set(k, p)
  }
  for (const p of nextPlans || []) {
    const k = deliveryPlanCellKey(p)
    if (k) nextM.set(k, p)
  }
  const keys = new Set([...prevM.keys(), ...nextM.keys()])
  const deltas = new Map()
  for (const key of keys) {
    const prev = prevM.get(key)
    const next = nextM.get(key)
    const pShipped = isPlanShipped(prev)
    const nShipped = isPlanShipped(next)
    const pConf = Number(prev?.confirmedQty) || 0
    const nQty = planQty(next || {})
    const parts = key.split('\t')
    const sku = `${parts[0]}\t${parts[1]}`
    let cellDelta = 0
    if (pShipped && !nShipped) cellDelta = pConf
    else if (!pShipped && nShipped) cellDelta = -nQty
    else if (pShipped && nShipped) cellDelta = pConf - nQty
    if (cellDelta !== 0) deltas.set(sku, (deltas.get(sku) || 0) + cellDelta)
  }
  return deltas
}

export function applyStockDeltasToMasterItems(masterItems, deltas) {
  if (!Array.isArray(masterItems) || !deltas?.size) return masterItems
  return masterItems.map((m) => {
    const k = `${m.modelName}\t${m.partNo}`
    if (!deltas.has(k)) return m
    const d = deltas.get(k) || 0
    const nextStock = Math.max(0, (Number(m.currentStock) || 0) + d)
    return { ...m, currentStock: nextStock }
  })
}

export function findInsufficientStockForDeltas(masterItems, deltas) {
  if (!deltas?.size) return []
  const bad = []
  for (const [sku, delta] of deltas) {
    if (delta >= 0) continue
    const [modelName, partNo] = sku.split('\t')
    const m = masterItems.find((x) => x.modelName === modelName && x.partNo === partNo)
    const stock = Number(m?.currentStock) || 0
    if (stock + delta < 0) bad.push({ modelName, partNo, stock, need: -(stock + delta) })
  }
  return bad
}

/** 저장 직후: 확정 시 confirmedQty = 현재 계획 수량, 미확정 시 0 */
export function normalizeDeliveryPlansForPersist(plans) {
  return (plans || []).map((p) => {
    const q = planQty(p)
    const shipped = isPlanShipped(p)
    return {
      ...p,
      qty: q,
      planQty: q,
      shipped,
      confirmedQty: shipped ? q : 0,
      locked: p.locked === true,
    }
  })
}

/** 부품 행 삭제 등으로 제거되는 확정 행 → 창고 복원량 */
export function stockRestoreDeltasFromRemovingPlans(removingPlans) {
  const deltas = new Map()
  for (const p of removingPlans || []) {
    if (!isPlanShipped(p)) continue
    const sku = `${p.modelName}\t${p.partNo}`
    const c = Number(p.confirmedQty) || planQty(p)
    deltas.set(sku, (deltas.get(sku) || 0) + c)
  }
  return deltas
}
