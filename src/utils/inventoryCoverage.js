import {
  getCoverageStatus,
  MIN_MANAGEMENT_WEEKS,
} from '../config/inventoryPolicy'
import { addDaysIso } from './deliveryPlanHorizon'
import { getWeekRange, isInTransitRowActive, planRowWeekStart } from './logisticsMetrics'
import { outboundQtyForSimulation } from './deliveryPlanModel'

/** 커버리지·Gap용 출고계획: 조회 주 포함 향후 이 주 수 */
const COVERAGE_PLAN_WEEK_COUNT = 4

/**
 * 레거시: 마스터 안전재고·단순 비율용
 */
export function calculateDemandBasedCoverageWeeks(currentStock, weeklyDemand) {
  const demand = Math.max(0, weeklyDemand)
  if (demand === 0) return currentStock > 0 ? Infinity : 0
  return currentStock / demand
}

/** 안전재고 = 평균 주간 출고계획 × 안전재고 주수 */
export function calculateSafetyStockFromWeeklyDemand(averageWeeklyDemand, weeks = MIN_MANAGEMENT_WEEKS) {
  return Math.max(0, averageWeeklyDemand) * weeks
}

/** 특정 주(월요일) 출고계획 합계 */
export function outboundPlanQtyForWeekMonday(planRows, modelName, partNo, weekMondayIso) {
  let sum = 0
  for (const p of planRows || []) {
    if (p.modelName !== modelName || p.partNo !== partNo) continue
    if (planRowWeekStart(p) !== weekMondayIso) continue
    sum += outboundQtyForSimulation(p)
  }
  return sum
}

/** 조회 기준일이 속한 주(월요일)의 출고계획 합계 */
export function outboundPlanQtyForAsOfWeek(planRows, modelName, partNo, asOfDate) {
  const anchorMonday = getWeekRange(asOfDate).start
  return outboundPlanQtyForWeekMonday(planRows, modelName, partNo, anchorMonday)
}

/**
 * 조회 주(포함)부터 연속 N주 출고계획 합계 (비어 있으면 0)
 */
export function sumOutboundPlanNextWeeksFromAsOf(
  planRows,
  modelName,
  partNo,
  asOfDate,
  weekCount = COVERAGE_PLAN_WEEK_COUNT,
) {
  let mon = getWeekRange(asOfDate).start
  let total = 0
  for (let i = 0; i < weekCount; i += 1) {
    total += outboundPlanQtyForWeekMonday(planRows, modelName, partNo, mon)
    mon = addDaysIso(mon, 7)
  }
  return total
}

/**
 * 커버리지(주) = max(0, 현재재고 / (4주 출고계획 합 / 4))
 * 4주 합이 0이면 null (표시 "—", 상태 unknown)
 */
export function computeCoverageFromFourWeekPlanSum(warehouseStock, fourWeekOutboundSum) {
  const sum4 = Math.max(0, Number(fourWeekOutboundSum) || 0)
  if (sum4 <= 0) return null
  const averageWeeklyDemand = sum4 / COVERAGE_PLAN_WEEK_COUNT
  if (averageWeeklyDemand <= 0) return null
  const stock = Math.max(0, Number(warehouseStock) || 0)
  return Math.max(0, stock / averageWeeklyDemand)
}

/**
 * 모델 KPI: Σ현재재고 ÷ (모델 전체 4주 출고계획 합 / 4)
 */
export function computePortfolioFourWeekAverageCoverageWeeks({
  masterItems,
  deliveryPlans,
  asOfDate,
  getWarehouseStockQty,
}) {
  const items = (masterItems || []).filter((m) => m.status !== 'Inactive')
  if (!items.length) return null

  let totalStock = 0
  let totalFourWeekOutbound = 0
  for (const it of items) {
    totalStock += Math.max(0, Number(getWarehouseStockQty(it)) || 0)
    totalFourWeekOutbound += sumOutboundPlanNextWeeksFromAsOf(
      deliveryPlans,
      it.modelName,
      it.partNo,
      asOfDate,
      COVERAGE_PLAN_WEEK_COUNT,
    )
  }
  return computeCoverageFromFourWeekPlanSum(totalStock, totalFourWeekOutbound)
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
  const fourWeekOutboundSum = sumOutboundPlanNextWeeksFromAsOf(
    itemDeliveryPlans,
    item.modelName,
    item.partNo,
    asOfDate,
    COVERAGE_PLAN_WEEK_COUNT,
  )
  const averageWeeklyDemand = fourWeekOutboundSum / COVERAGE_PLAN_WEEK_COUNT

  const weeklyDemand = averageWeeklyDemand
  const plannedDelivery = fourWeekOutboundSum
  const confirmedDelivery = null

  const inTransitQty = sumInTransitByPart(inTransitContainers, item.modelName, item.partNo)

  const warehouseStock =
    warehouseStockQty != null && !Number.isNaN(Number(warehouseStockQty))
      ? Math.max(0, Number(warehouseStockQty))
      : Number(item.currentStock) || 0

  const coverageWeeks = computeCoverageFromFourWeekPlanSum(warehouseStock, fourWeekOutboundSum)

  const safetyWeeks =
    item.safetyStockWeeks != null && item.safetyStockWeeks !== ''
      ? Math.max(0, Number(item.safetyStockWeeks) || 0)
      : MIN_MANAGEMENT_WEEKS
  const safetyStockQty = calculateSafetyStockFromWeeklyDemand(averageWeeklyDemand, safetyWeeks)
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
