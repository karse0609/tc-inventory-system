import { planWeekMonday } from './deliveryPlanHorizon'

/** localStorage / 백업 JSON에 저장되는 출고계획 래퍼 버전 */
export const PLANS_STORAGE_VERSION = 2

/**
 * 주차별 확정: `weekConfirmations[weekMonday] === true` 이면 해당 주 모든 품번 셀의
 * `planQty`가 출고 확정으로 간주되어 재고에 반영됩니다.
 *
 * 셀 스키마 (Daily Delivery Excel 등 확장용):
 * @typedef {object} DeliveryPlanCell
 * @property {number} planQty — 화면 계획 수량 (`qty`와 동기)
 * @property {number} confirmedQty — 창고에 반영된 확정 수량(저장 시 week 확정이면 planQty, 아니면 0)
 *
 * `shipped` 필드는 레거시 호환용으로만 읽고, 저장 시 제거합니다.
 */

/** 주차 셀 계획 수량 (qty / planQty / plannedQty 호환) */
export function planQty(p) {
  if (!p || typeof p !== 'object') return 0
  const raw = p.planQty != null ? p.planQty : p.qty ?? p.plannedQty
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

/** @deprecated 레거시 셀별 shipped — 주차 확정으로 대체됨 */
export function isPlanShipped(p) {
  return p?.shipped === true
}

export function isWeekConfirmed(weekConfirmations, weekMonday) {
  if (!weekMonday || !weekConfirmations || typeof weekConfirmations !== 'object') return false
  return weekConfirmations[weekMonday] === true
}

/**
 * 재고 예측·역산용 출고 분량: 주차가 확정되어 재고에 반영된 주는 0 (이중 차감 방지)
 */
export function outboundQtyForSimulation(p, weekConfirmations = {}) {
  const mon = planWeekMonday(p)
  if (mon && isWeekConfirmed(weekConfirmations, mon)) return 0
  return planQty(p)
}

export function deliveryPlanCellKey(p) {
  const mon = planWeekMonday(p)
  if (!mon || !p.modelName || !p.partNo) return ''
  return `${p.modelName}\t${p.partNo}\t${mon}`
}

/** 레거시: 셀별 shipped=true 인 주차를 주차 확정으로 승격 */
export function inferWeekConfirmationsFromLegacyPlans(plans) {
  const w = {}
  for (const p of plans || []) {
    const mon = planWeekMonday(p)
    if (mon && p?.shipped === true) w[mon] = true
  }
  return w
}

/**
 * localStorage 원본 → { cells, weekConfirmations }
 * - 배열: v1 레거시
 * - { cells, weekConfirmations }: v2
 */
export function parsePlansStorageValue(raw) {
  if (raw == null) return { cells: [], weekConfirmations: {} }
  if (Array.isArray(raw)) {
    return {
      cells: raw,
      weekConfirmations: inferWeekConfirmationsFromLegacyPlans(raw),
    }
  }
  if (typeof raw === 'object' && Array.isArray(raw.cells)) {
    const inferred = inferWeekConfirmationsFromLegacyPlans(raw.cells)
    const wc =
      raw.weekConfirmations && typeof raw.weekConfirmations === 'object' && !Array.isArray(raw.weekConfirmations)
        ? { ...raw.weekConfirmations }
        : {}
    return { cells: raw.cells, weekConfirmations: { ...inferred, ...wc } }
  }
  return { cells: [], weekConfirmations: {} }
}

/** 저장용 JSON 값 */
export function toPlansStorageValue(cells, weekConfirmations) {
  return {
    version: PLANS_STORAGE_VERSION,
    cells: cells || [],
    weekConfirmations: weekConfirmations && typeof weekConfirmations === 'object' ? { ...weekConfirmations } : {},
  }
}

/**
 * 창고에 이미 반영된 확정 수량 (직전 저장 스냅샷의 confirmedQty)
 */
export function committedQtyOnRecord(row) {
  if (!row || typeof row !== 'object') return 0
  const c = Number(row.confirmedQty)
  if (Number.isFinite(c) && c >= 0) return Math.floor(c)
  return 0
}

/**
 * 이번 저장에서 목표 확정 수량:
 * newConfirmedQty = weekConfirmed ? planQty : 0
 */
export function nextCommittedQtyForSave(row, weekConfirmations) {
  if (!row || typeof row !== 'object') return 0
  const mon = planWeekMonday(row)
  if (!mon || !isWeekConfirmed(weekConfirmations, mon)) return 0
  return planQty(row)
}

/**
 * 이전 저장본 vs 저장 예정본 → SKU별 창고 조정량
 * delta = Σ( newConfirmedQty - previousConfirmedQty ) per cell
 * warehouseStock = warehouseStock - delta
 *
 * @param {Record<string, boolean>} nextWeekConfirmations 저장 직후 주차 확정 맵
 * @returns {Map<string, number>} key = modelName\tpartNo
 */
export function computeStockDeltasBySku(prevPlans, nextPlans, nextWeekConfirmations = {}) {
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
  const wc = nextWeekConfirmations && typeof nextWeekConfirmations === 'object' ? nextWeekConfirmations : {}
  for (const key of keys) {
    const prev = prevM.get(key)
    const next = nextM.get(key)
    const prevCommitted = committedQtyOnRecord(prev)
    const nextCommitted = nextCommittedQtyForSave(next, wc)
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

/**
 * 저장 직후 셀 정규화: shipped 제거, confirmedQty = 주차 확정 시 planQty
 */
export function normalizeDeliveryPlansForPersist(plans, weekConfirmations = {}) {
  const wc = weekConfirmations && typeof weekConfirmations === 'object' ? weekConfirmations : {}
  return (plans || []).map((p) => {
    const q = planQty(p)
    const mon = planWeekMonday(p)
    const confirmed = mon && wc[mon] === true ? q : 0
    const { shipped: _s, ...rest } = p
    return {
      ...rest,
      qty: q,
      planQty: q,
      confirmedQty: confirmed,
      locked: p.locked === true,
    }
  })
}

/** 재고 delta 계산용 직전 스냅샷 (cells 정규화 + weekConfirmations) */
export function serializeWarehouseBaselinePlansSnapshot(cells, weekConfirmations) {
  return JSON.stringify({
    cells: normalizeDeliveryPlansForPersist(cells || [], weekConfirmations || {}),
    weekConfirmations: { ...(weekConfirmations || {}) },
  })
}

export function parseWarehouseBaselinePlansSnapshot(json) {
  try {
    const o = JSON.parse(String(json || '{}'))
    if (Array.isArray(o)) {
      const wc = inferWeekConfirmationsFromLegacyPlans(o)
      return { cells: o, weekConfirmations: wc }
    }
    const cells = Array.isArray(o.cells) ? o.cells : []
    const wc =
      o.weekConfirmations && typeof o.weekConfirmations === 'object' && !Array.isArray(o.weekConfirmations)
        ? { ...o.weekConfirmations }
        : inferWeekConfirmationsFromLegacyPlans(cells)
    return { cells, weekConfirmations: wc }
  } catch {
    return { cells: [], weekConfirmations: {} }
  }
}

/**
 * 저장 시 디버그: 셀별 prev/next 확정분·delta·SKU 창고(누적 반영 후 잔고)
 */
export function logDeliveryPlanSaveWarehouseDebug({
  prevPlans,
  nextPlans,
  nextWeekConfirmations,
  masterItems,
}) {
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
  const wc = nextWeekConfirmations && typeof nextWeekConfirmations === 'object' ? nextWeekConfirmations : {}

  for (const key of keys) {
    const prev = prevM.get(key)
    const next = nextM.get(key)
    const prevCommitted = committedQtyOnRecord(prev)
    const newCommittedQty = nextCommittedQtyForSave(next, wc)
    const cellDelta = newCommittedQty - prevCommitted
    const hasShipContext =
      cellDelta !== 0 ||
      prevCommitted > 0 ||
      newCommittedQty > 0 ||
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
