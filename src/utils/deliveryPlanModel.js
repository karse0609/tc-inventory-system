import { planWeekMonday } from './deliveryPlanHorizon'

/**
 * 주차 셀 스키마 (Daily Delivery Excel 업로드 등에서 동일 필드로 채울 수 있도록 유지)
 *
 * @typedef {object} DeliveryPlanCell
 * @property {number} planQty — 화면 계획 수량 (`qty`와 동기 권장)
 * @property {boolean} shipped — 출고 확정 여부
 * @property {number} confirmedQty — 창고에 반영된 확정 수량(저장 직후 확정이면 `planQty`와 동일)
 *
 * 업로드로 반영할 때: `shipped: true`, `planQty`/`qty`, `confirmedQty`를 목표 상태로 맞춘 뒤
 * `normalizeDeliveryPlansForPersist` → `computeStockDeltasBySku(직전 재고반영 스냅샷, normalized)`로
 * 이전 저장본 대비 delta만 창고에 적용하면 됩니다. (브라우저 저장소는 편집 중간값으로 덮일 수 있으므로
 * 출고계획 화면에서는 `serializeWarehouseBaselinePlansSnapshot` ref 기준 prev를 사용합니다.)
 */

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
 * 저장 스냅샷 기준: 창고에 이미 반영된 확정 수량 (미확정이면 0)
 */
export function committedQtyOnRecord(row) {
  if (!row || typeof row !== 'object' || !isPlanShipped(row)) return 0
  const c = Number(row.confirmedQty)
  if (Number.isFinite(c) && c >= 0) return Math.floor(c)
  return planQty(row)
}

/**
 * 이번 저장에서 반영할 “새 확정 수량”: 확정이면 현재 계획 수량, 아니면 0
 */
export function nextCommittedQtyForSave(row) {
  if (!row || typeof row !== 'object' || !isPlanShipped(row)) return 0
  return planQty(row)
}

/**
 * 이전 저장본 vs 저장 예정본 → SKU별 창고 조정량
 * delta = Σ( newConfirmedQty - previousConfirmedQty ) per cell
 * 적용: warehouseStock = warehouseStock - delta  (delta>0 이면 추가 출고 확정으로 재고 감소)
 *
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
    const prevCommitted = committedQtyOnRecord(prev)
    const nextCommitted = nextCommittedQtyForSave(next)
    const cellDelta = nextCommitted - prevCommitted
    if (cellDelta === 0) continue
    const parts = key.split('\t')
    const sku = `${parts[0]}\t${parts[1]}`
    deltas.set(sku, (deltas.get(sku) || 0) + cellDelta)
  }
  return deltas
}

export function applyStockDeltasToMasterItems(masterItems, deltas) {
  if (!Array.isArray(masterItems) || !deltas?.size) return masterItems
  return masterItems.map((m) => {
    const k = `${m.modelName}\t${m.partNo}`
    if (!deltas.has(k)) return m
    const d = deltas.get(k) || 0
    const nextStock = Math.max(0, (Number(m.currentStock) || 0) - d)
    return { ...m, currentStock: nextStock }
  })
}

/** delta>0: 추가 출고 확정분만큼 재고가 있어야 함 */
export function findInsufficientStockForDeltas(masterItems, deltas) {
  if (!deltas?.size) return []
  const bad = []
  for (const [sku, delta] of deltas) {
    if (delta <= 0) continue
    const [modelName, partNo] = sku.split('\t')
    const m = masterItems.find((x) => x.modelName === modelName && x.partNo === partNo)
    const stock = Number(m?.currentStock) || 0
    if (stock < delta) bad.push({ modelName, partNo, stock, need: delta - stock })
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

/** 재고 delta 계산용 직전 스냅샷 직렬화(항상 normalize 후 stringify) */
export function serializeWarehouseBaselinePlansSnapshot(plans) {
  return JSON.stringify(normalizeDeliveryPlansForPersist(plans || []))
}

export function parseWarehouseBaselinePlansSnapshot(json) {
  try {
    const arr = JSON.parse(String(json || '[]'))
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

/**
 * 저장 시 디버그: 셀별 prev/next 확정분·delta·SKU 창고(누적 반영 후 잔고)
 */
export function logDeliveryPlanSaveWarehouseDebug({ prevPlans, nextPlans, masterItems }) {
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
  const keys = [...new Set([...prevM.keys(), ...nextM.keys()])].sort()
  const runningSku = new Map()

  for (const key of keys) {
    const prev = prevM.get(key)
    const next = nextM.get(key)
    const prevCommitted = committedQtyOnRecord(prev)
    const newCommittedQty = nextCommittedQtyForSave(next)
    const cellDelta = newCommittedQty - prevCommitted
    const hasShipContext =
      cellDelta !== 0 ||
      (prev && isPlanShipped(prev)) ||
      (next && isPlanShipped(next)) ||
      (next && planQty(next) > 0) ||
      (prev && planQty(prev) > 0)
    if (!hasShipContext) continue

    const segs = key.split('\t')
    const modelName = segs[0] || ''
    const partNo = segs[1] || ''
    const week = segs[2] || ''
    const sku = `${modelName}\t${partNo}`
    const m = (masterItems || []).find((x) => x.modelName === modelName && x.partNo === partNo)
    const stockBefore = Number(m?.currentStock) || 0
    runningSku.set(sku, (runningSku.get(sku) || 0) + cellDelta)
    const stockAfter = Math.max(0, stockBefore - runningSku.get(sku))

    console.log('[tc-inv delivery-save]', {
      modelName,
      partNo,
      week,
      planQty: next ? planQty(next) : planQty(prev || {}),
      previousConfirmedQty: prevCommitted,
      newConfirmedQty: newCommittedQty,
      delta: cellDelta,
      stockBefore,
      stockAfter,
    })
  }
}
