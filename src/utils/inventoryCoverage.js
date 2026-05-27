import {
  getCoverageStatus,
  MIN_MANAGEMENT_WEEKS,
} from '../config/inventoryPolicy'
import { getFutureDeliveryPlans, isInTransitRowActive } from './logisticsMetrics'
import { outboundQtyForSimulation, planQty } from './deliveryPlanModel'

export function getWeeklyDemandSeries(itemDeliveryPlans, asOfDate) {
  const future = getFutureDeliveryPlans(itemDeliveryPlans, asOfDate)
  return future.map((row) => outboundQtyForSimulation(row))
}

export function sumInTransitByPart(containers, modelName, partNo) {
  return containers
    .filter(
      (c) =>
        c.partNo === partNo &&
        c.modelName === modelName &&
        isInTransitRowActive(c),
    )
    .reduce((sum, c) => sum + (Number(c.qty) || 0), 0)
}

/**
 * 첫 번째 미래 주차의 계획/확정 납품 (Part 단위)
 */
function getFirstFutureWeekPlan(partPlans, asOfDate) {
  const future = getFutureDeliveryPlans(partPlans, asOfDate)
  return future[0] ?? null
}

/**
 * Coverage Weeks = Current Stock ÷ Weekly Demand
 * Weekly Demand = 다음 주차 확정 > 계획 (confirmed ?? planned)
 */
export function calculateDemandBasedCoverageWeeks(currentStock, weeklyDemand) {
  const demand = Math.max(0, weeklyDemand)
  if (demand === 0) return currentStock > 0 ? Infinity : 0
  return currentStock / demand
}

/** 안전재고(4주) = Weekly Demand × 4 */
export function calculateSafetyStockFromWeeklyDemand(weeklyDemand, weeks = MIN_MANAGEMENT_WEEKS) {
  return Math.max(0, weeklyDemand) * weeks
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
  const partPlans = itemDeliveryPlans.filter(
    (p) => p.partNo === item.partNo && p.modelName === item.modelName,
  )
  const weeklyDemand =
    item.weeklyDemand != null && item.weeklyDemand !== ''
      ? Number(item.weeklyDemand) || 0
      : (getWeeklyDemandSeries(partPlans, asOfDate)[0] ?? 0)

  const firstWeek = getFirstFutureWeekPlan(partPlans, asOfDate)
  const plannedDelivery = planQty(firstWeek || {})
  const confirmedDelivery = null

  const inTransitQty = sumInTransitByPart(
    inTransitContainers,
    item.modelName,
    item.partNo,
  )
  const warehouseStock =
    warehouseStockQty != null && !Number.isNaN(Number(warehouseStockQty))
      ? Math.max(0, Number(warehouseStockQty))
      : Number(item.currentStock) || 0

  const coverageWeeks = calculateDemandBasedCoverageWeeks(
    warehouseStock,
    weeklyDemand,
  )
  const safetyWeeks =
    item.safetyStockWeeks != null && item.safetyStockWeeks !== ''
      ? Math.max(0, Number(item.safetyStockWeeks) || 0)
      : MIN_MANAGEMENT_WEEKS
  const safetyStockQty = calculateSafetyStockFromWeeklyDemand(weeklyDemand, safetyWeeks)
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

export function buildInventorySummary(itemRows) {
  const warehouseValue = itemRows.reduce((s, r) => s + r.warehouseValue, 0)
  const inTransitValue = itemRows.reduce((s, r) => s + r.inTransitValue, 0)
  const totalStock = itemRows.reduce((s, r) => s + r.currentStock, 0)
  const totalInTransit = itemRows.reduce((s, r) => s + r.inTransitQty, 0)

  const coverageValues = itemRows.map((r) => r.coverageWeeks)
  const finiteVals = coverageValues.filter(Number.isFinite)
  const minCoverage =
    finiteVals.length > 0
      ? Math.min(...finiteVals)
      : coverageValues.some((v) => v === Infinity)
        ? Infinity
        : 0
  const avgFinite =
    finiteVals.length > 0
      ? finiteVals.reduce((a, b) => a + b, 0) / finiteVals.length
      : 0

  return {
    warehouseValue,
    inTransitValue,
    totalInventoryValue: warehouseValue + inTransitValue,
    totalStock,
    totalInTransit,
    minCoverageWeeks: minCoverage,
    avgCoverageWeeks: avgFinite,
    itemCount: itemRows.length,
  }
}
