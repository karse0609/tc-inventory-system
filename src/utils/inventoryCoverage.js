import {
  getCoverageStatus,
  MIN_MANAGEMENT_WEEKS,
} from '../config/inventoryPolicy'
import {
  collectFutureFlowWeekMondays,
  getFutureDeliveryPlans,
  inboundQtyForWeek,
  isInTransitRowActive,
  planRowWeekStart,
} from './logisticsMetrics'
import { planQty, outboundQtyForSimulation } from './deliveryPlanModel'

/**
 * 주차별 입고·출고(출고계획) 누적 반영 후, 향후 출고계획을 몇 주(분수 포함)까지 버틸 수 있는지.
 * 각 주: 가용재고 += 입고, 출고 O>0 이면 min(1, S/O) 주만큼 커버; 부족 시 마지막 주는 S/O 로 분수.
 *
 * @param {number} initialWarehouseStock 조회 시점 창고재고
 * @param {{ inbound: number, outbound: number }[]} weeklyFlows 기준일 주(포함) 이후 시간순
 */
export function calculateFlowCoverageWeeks(initialWarehouseStock, weeklyFlows) {
  const flows = Array.isArray(weeklyFlows) ? weeklyFlows : []
  let S = Math.max(0, Number(initialWarehouseStock) || 0)
  let covered = 0
  let stoppedPartial = false
  let sawPositiveOutbound = false

  for (const w of flows) {
    const I = Math.max(0, Number(w.inbound) || 0)
    const O = Math.max(0, Number(w.outbound) || 0)
    if (O > 0) sawPositiveOutbound = true
    S += I
    if (O <= 0) continue
    if (S >= O) {
      S -= O
      covered += 1
    } else {
      covered += S / O
      S = 0
      stoppedPartial = true
      break
    }
  }

  if (stoppedPartial) return covered
  if (!sawPositiveOutbound) return S > 0 ? Infinity : 0
  return Infinity
}

/**
 * 레거시: 마스터 안전재고·단숀 비율용 (커버리지 KPI에는 사용하지 않음)
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

function outboundPlanQtyForWeek(planRows, modelName, partNo, mondayIso) {
  let sum = 0
  for (const p of planRows || []) {
    if (p.modelName !== modelName || p.partNo !== partNo) continue
    if (planRowWeekStart(p) !== mondayIso) continue
    sum += outboundQtyForSimulation(p)
  }
  return sum
}

function buildWeeklyFlowsForSku({
  weekMondays,
  deliveryPlans,
  inTransitContainers,
  modelName,
  partNo,
}) {
  return weekMondays.map((mon) => ({
    inbound: inboundQtyForWeek(inTransitContainers, modelName, partNo, mon),
    outbound: outboundPlanQtyForWeek(deliveryPlans, modelName, partNo, mon),
  }))
}

/**
 * 선택 모델(또는 전체) 기준: 총 창고재고 + 주차별 총 입고 − 총 출고계획 누적으로 커버리지(주).
 */
export function computePortfolioFlowCoverageWeeks({
  masterItems,
  deliveryPlans,
  inTransitContainers,
  asOfDate,
  modelName,
  getWarehouseStockQty,
}) {
  const items = (masterItems || []).filter((m) => m.status !== 'Inactive')
  if (!items.length) return 0

  const weekMondays = collectFutureFlowWeekMondays(
    deliveryPlans,
    inTransitContainers,
    asOfDate,
    modelName,
    null,
  )

  const initial = items.reduce((s, it) => s + Math.max(0, Number(getWarehouseStockQty(it)) || 0), 0)

  const weeklyFlows = weekMondays.map((mon) => {
    let inbound = 0
    let outbound = 0
    for (const it of items) {
      inbound += inboundQtyForWeek(inTransitContainers, it.modelName, it.partNo, mon)
      outbound += outboundPlanQtyForWeek(deliveryPlans, it.modelName, it.partNo, mon)
    }
    return { inbound, outbound }
  })

  return calculateFlowCoverageWeeks(initial, weeklyFlows)
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
  const partPlans = itemDeliveryPlans.filter(
    (p) => p.partNo === item.partNo && p.modelName === item.modelName,
  )

  const firstWeekFromFuture = getFutureDeliveryPlans(partPlans, asOfDate)[0] ?? null

  const weeklyDemand =
    item.weeklyDemand != null && item.weeklyDemand !== ''
      ? Number(item.weeklyDemand) || 0
      : planQty(firstWeekFromFuture || {})

  const plannedDelivery = planQty(firstWeekFromFuture || {})
  const confirmedDelivery = null

  const inTransitQty = sumInTransitByPart(inTransitContainers, item.modelName, item.partNo)

  const warehouseStock =
    warehouseStockQty != null && !Number.isNaN(Number(warehouseStockQty))
      ? Math.max(0, Number(warehouseStockQty))
      : Number(item.currentStock) || 0

  const weekMondays = collectFutureFlowWeekMondays(
    itemDeliveryPlans,
    inTransitContainers,
    asOfDate,
    item.modelName,
    { modelName: item.modelName, partNo: item.partNo },
  )
  const weeklyFlows = buildWeeklyFlowsForSku({
    weekMondays,
    deliveryPlans: itemDeliveryPlans,
    inTransitContainers,
    modelName: item.modelName,
    partNo: item.partNo,
  })
  const coverageWeeks = calculateFlowCoverageWeeks(warehouseStock, weeklyFlows)

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

export function buildInventorySummary(itemRows, options = {}) {
  const { portfolioCoverageWeeks = null } = options
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

  const portfolio =
    portfolioCoverageWeeks != null && Number.isFinite(portfolioCoverageWeeks)
      ? portfolioCoverageWeeks
      : portfolioCoverageWeeks === Infinity
        ? Infinity
        : null

  return {
    warehouseValue,
    inTransitValue,
    totalInventoryValue: warehouseValue + inTransitValue,
    totalStock,
    totalInTransit,
    minCoverageWeeks: minCoverage,
    /** 모델 선택 시 총 재고·총 입고·총 출고계획 누적 커버리지 (KPI용) */
    portfolioCoverageWeeks: portfolio,
    avgCoverageWeeks: avgFinite,
    itemCount: itemRows.length,
  }
}
