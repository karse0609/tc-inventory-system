import {
  getCoverageStatus,
  MIN_MANAGEMENT_WEEKS,
} from '../config/inventoryPolicy'
import { isInTransitRowActive } from './logisticsMetrics'
import { modelsMatch } from './modelName'

/**
 * 레거시: 단순 비율 (다른 화면 호환)
 */
export function calculateDemandBasedCoverageWeeks(currentStock, weeklyDemand) {
  const demand = Math.max(0, weeklyDemand)
  if (demand === 0) return currentStock > 0 ? Infinity : 0
  return currentStock / demand
}

/** 안전재고 = 주간 수요 × 안전재고 주수 */
export function calculateSafetyStockFromWeeklyDemand(weeklyDemand, weeks = MIN_MANAGEMENT_WEEKS) {
  if (weeklyDemand == null || !Number.isFinite(weeklyDemand) || weeklyDemand <= 0) return null
  return Math.max(0, weeklyDemand) * weeks
}

/**
 * 창고재고(Master) 주간 수요: 양수만 커버리지·Gap에 사용.
 * 0·비어 있음·NaN → null (coverage "—", gap "—", status unknown)
 */
export function parseMasterWeeklyDemandForCoverage(item) {
  if (!item || item.weeklyDemand == null || item.weeklyDemand === '') return null
  const n = Number(item.weeklyDemand)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

/**
 * 커버리지(주) = max(0, 현재재고 / 주간수요)
 * 주간수요 없음 → null
 */
export function computeCoverageFromMasterWeeklyDemand(warehouseStock, weeklyDemand) {
  if (weeklyDemand == null || weeklyDemand <= 0) return null
  const stock = Math.max(0, Number(warehouseStock) || 0)
  return Math.max(0, stock / weeklyDemand)
}

/**
 * 모델 KPI: 주간수요가 입력된 품목만 합산 — Σ재고 / Σ주간수요
 */
export function computePortfolioWeeklyDemandCoverageWeeks({ masterItems, getWarehouseStockQty }) {
  const items = (masterItems || []).filter((m) => m.status !== 'Inactive')
  if (!items.length) return null

  let totalStock = 0
  let totalDemand = 0
  for (const it of items) {
    const d = parseMasterWeeklyDemandForCoverage(it)
    if (d == null) continue
    totalStock += Math.max(0, Number(getWarehouseStockQty(it)) || 0)
    totalDemand += d
  }
  if (totalDemand <= 0) return null
  return Math.max(0, totalStock / totalDemand)
}

export function sumInTransitByPart(containers, modelName, partNo) {
  return (containers || [])
    .filter(
      (c) =>
        c.partNo === partNo &&
        modelsMatch(c.modelName, modelName) &&
        isInTransitRowActive(c),
    )
    .reduce((sum, c) => sum + (Number(c.qty) || 0), 0)
}

/**
 * 품번(Part No)만 일치하는 미입고 운송중 행 수량 합산 — 모델명 무관(참고용 표시).
 * 입고 완료·arrived 행 제외 (`isInTransitRowActive`).
 */
export function sumInTransitQtyByPartNo(containers, partNo) {
  const p = String(partNo ?? '').trim()
  if (!p) return 0
  return (containers || [])
    .filter((c) => isInTransitRowActive(c) && String(c.partNo ?? '').trim() === p)
    .reduce((sum, c) => sum + (Number(c.qty) || 0), 0)
}

/**
 * Item 단위 재고 현황 (modelName + partNo)
 * 커버리지·Gap은 Master의 Weekly Demand만 사용 (출고계획 미사용).
 * @param {object[]} [inTransitByPartNoContainers] 품번 기준 운송중 참고 합산(모델 무관). 생략 시 `inTransitContainers` 사용.
 */
export function buildItemInventoryStatus({
  item,
  itemDeliveryPlans: _itemDeliveryPlans,
  inTransitContainers,
  inTransitByPartNoContainers,
  asOfDate: _asOfDate,
  /** 기준일 시점 창고 재고(없으면 item.currentStock) */
  warehouseStockQty,
}) {
  const masterWeeklyDemand = parseMasterWeeklyDemandForCoverage(item)

  /** 표시용: 주간수요 미입력·0이면 null → UI에서 "—" */
  const weeklyDemand = masterWeeklyDemand
  /** 대시보드 표: 출고계획 기반 아님 — 미표시 */
  const plannedDelivery = null
  const confirmedDelivery = null

  const transitForPartRef = inTransitByPartNoContainers ?? inTransitContainers
  const inTransitQty = sumInTransitQtyByPartNo(transitForPartRef, item.partNo)

  const warehouseStock =
    warehouseStockQty != null && !Number.isNaN(Number(warehouseStockQty))
      ? Math.max(0, Number(warehouseStockQty))
      : Number(item.currentStock) || 0

  const coverageWeeks = computeCoverageFromMasterWeeklyDemand(warehouseStock, masterWeeklyDemand)

  const safetyWeeks =
    item.safetyStockWeeks != null && item.safetyStockWeeks !== ''
      ? Math.max(0, Number(item.safetyStockWeeks) || 0)
      : MIN_MANAGEMENT_WEEKS

  const safetyStockQty =
    masterWeeklyDemand != null
      ? calculateSafetyStockFromWeeklyDemand(masterWeeklyDemand, safetyWeeks)
      : null
  const gap =
    masterWeeklyDemand != null && safetyStockQty != null
      ? warehouseStock - safetyStockQty
      : null

  const status = getCoverageStatus(coverageWeeks)

  const warehouseValue = 0
  const inTransitValue = 0

  return {
    modelName: item.modelName,
    partNo: item.partNo,
    description: item.description,
    currentStock: warehouseStock,
    inTransitQty,
    weeklyDemand,
    plannedDelivery,
    confirmedDelivery,
    coverageWeeks,
    safetyStockQty,
    safetyStockWeeks: safetyWeeks,
    gap,
    status,
    warehouseValue,
    inTransitValue,
    totalValue: warehouseValue + inTransitValue,
  }
}

export function buildInventorySummary(itemRows, options = {}) {
  const { portfolioCoverageWeeks = null, totalActiveInTransitQty = null } = options
  const warehouseValue = itemRows.reduce((s, r) => s + r.warehouseValue, 0)
  const inTransitValue = itemRows.reduce((s, r) => s + r.inTransitValue, 0)
  const totalStock = itemRows.reduce((s, r) => s + r.currentStock, 0)

  let totalInTransit = totalActiveInTransitQty
  if (totalInTransit == null || !Number.isFinite(totalInTransit)) {
    const seenPart = new Set()
    totalInTransit = 0
    for (const r of itemRows) {
      const k = String(r.partNo ?? '').trim()
      if (!k || seenPart.has(k)) continue
      seenPart.add(k)
      totalInTransit += Number(r.inTransitQty) || 0
    }
  }

  const finiteVals = itemRows
    .map((r) => r.coverageWeeks)
    .filter((v) => v != null && Number.isFinite(v))
  const minCoverage = finiteVals.length > 0 ? Math.min(...finiteVals) : null
  const avgFinite =
    finiteVals.length > 0 ? finiteVals.reduce((a, b) => a + b, 0) / finiteVals.length : 0

  const portfolio =
    portfolioCoverageWeeks != null && Number.isFinite(portfolioCoverageWeeks)
      ? portfolioCoverageWeeks
      : null

  return {
    warehouseValue,
    inTransitValue,
    totalInventoryValue: warehouseValue + inTransitValue,
    totalStock,
    totalInTransit,
    minCoverageWeeks: minCoverage,
    portfolioCoverageWeeks: portfolio,
    avgCoverageWeeks: avgFinite,
    itemCount: itemRows.length,
  }
}
