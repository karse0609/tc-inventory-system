import {
  getCoverageStatus,
  MIN_MANAGEMENT_WEEKS,
} from '../config/inventoryPolicy'
import { getWeekRange, isInTransitRowActive, planRowWeekStart } from './logisticsMetrics'
import { outboundQtyForSimulation } from './deliveryPlanModel'

/**
 * 레거시: 마스터 안전재고·단순 비율용
 */
export function calculateDemandBasedCoverageWeeks(currentStock, weeklyDemand) {
  const demand = Math.max(0, weeklyDemand)
  if (demand === 0) return currentStock > 0 ? Infinity : 0
  return currentStock / demand
}

/** 안전재고 = 1주 납품계획(조회 주차) × 안전재고 주수 */
export function calculateSafetyStockFromWeeklyDemand(weeklyPlanQty, weeks = MIN_MANAGEMENT_WEEKS) {
  return Math.max(0, weeklyPlanQty) * weeks
}

/** 조회 기준일이 속한 주(월요일)의 출고계획 합계 */
export function outboundPlanQtyForAsOfWeek(planRows, modelName, partNo, asOfDate) {
  const anchorMonday = getWeekRange(asOfDate).start
  let sum = 0
  for (const p of planRows || []) {
    if (p.modelName !== modelName || p.partNo !== partNo) continue
    if (planRowWeekStart(p) !== anchorMonday) continue
    sum += outboundQtyForSimulation(p)
  }
  return sum
}

/**
 * 커버리지(주) = max(0, 현재재고 / 조회 주차 납품계획)
 * 납품계획 0이면 null (표시 "—", 상태 unknown)
 */
export function computeThisWeekPlanCoverageWeeks(warehouseStock, weekPlanQty) {
  const plan = Math.max(0, Number(weekPlanQty) || 0)
  if (plan <= 0) return null
  const stock = Math.max(0, Number(warehouseStock) || 0)
  return Math.max(0, stock / plan)
}

/**
 * 모델 선택: Σ현재재고 / Σ(조회 주차 납품계획)
 */
export function computePortfolioThisWeekCoverageWeeks({
  masterItems,
  deliveryPlans,
  asOfDate,
  modelName,
  getWarehouseStockQty,
}) {
  const items = (masterItems || []).filter((m) => m.status !== 'Inactive')
  if (!items.length) return null

  let totalStock = 0
  let totalPlan = 0
  for (const it of items) {
    totalStock += Math.max(0, Number(getWarehouseStockQty(it)) || 0)
    totalPlan += outboundPlanQtyForAsOfWeek(deliveryPlans, it.modelName, it.partNo, asOfDate)
  }
  return computeThisWeekPlanCoverageWeeks(totalStock, totalPlan)
}

export function sumInTransitByPart(containers, modelName, partNo) {
  return (containers || [])
    .filter(
      (c) =>
        c.partNo === partNo &&
        c.modelName === modelName &&
        isInTransitRowActive(c),
    )
    .reduce((sum, c) => sum + (Number(c.qty) || 0), 0)
}

/**
 * Item 단위 재고 현황 (modelName + partNo)
 */
export function buildItemInventoryStatus({
  item,
  itemDeliveryPlans,
  inTransitContainers,
  asOfDate,
  /** 기준일 시점 창고 재고(없으면 item.currentStock) */
  warehouseStockQty,
}) {
  const weekPlanQty = outboundPlanQtyForAsOfWeek(
    itemDeliveryPlans,
    item.modelName,
    item.partNo,
    asOfDate,
  )

  const weeklyDemand = weekPlanQty
  const plannedDelivery = weekPlanQty
  const confirmedDelivery = null

  const inTransitQty = sumInTransitByPart(inTransitContainers, item.modelName, item.partNo)

  const warehouseStock =
    warehouseStockQty != null && !Number.isNaN(Number(warehouseStockQty))
      ? Math.max(0, Number(warehouseStockQty))
      : Number(item.currentStock) || 0

  const coverageWeeks = computeThisWeekPlanCoverageWeeks(warehouseStock, weekPlanQty)

  const safetyWeeks =
    item.safetyStockWeeks != null && item.safetyStockWeeks !== ''
      ? Math.max(0, Number(item.safetyStockWeeks) || 0)
      : MIN_MANAGEMENT_WEEKS
  const safetyStockQty = calculateSafetyStockFromWeeklyDemand(weekPlanQty, safetyWeeks)
  const gap = warehouseStock - safetyStockQty
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
  const { portfolioCoverageWeeks = null } = options
  const warehouseValue = itemRows.reduce((s, r) => s + r.warehouseValue, 0)
  const inTransitValue = itemRows.reduce((s, r) => s + r.inTransitValue, 0)
  const totalStock = itemRows.reduce((s, r) => s + r.currentStock, 0)
  const totalInTransit = itemRows.reduce((s, r) => s + r.inTransitQty, 0)

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
