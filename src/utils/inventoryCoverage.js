import {
  getCoverageStatus,
  MIN_MANAGEMENT_WEEKS,
} from '../config/inventoryPolicy'
import { addDaysIso } from './deliveryPlanHorizon'
import {
  filterByModel,
  getFutureDeliveryPlans,
  getWeekRange,
  inboundQtyForWeek,
  isInTransitRowActive,
  planRowWeekStart,
  warehouseReceiptDateFromEtaPort,
} from './logisticsMetrics'
import { planQty, outboundQtyForSimulation } from './deliveryPlanModel'

/** ETA+7 도착이 없을 때 출고 합산·평균 주간 수요용 기본 기간(주) */
const FALLBACK_COVERAGE_PERIOD_WEEKS = 8

/**
 * 주차별 입고·출고(출고계획) 누적 반영 후, 향후 출고계획을 몇 주(분수 포함)까지 버틸 수 있는지.
 * (재고 예측 화면 등 — 대시보드 커버리지와는 별도)
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
 * 레거시: 마스터 안전재고·단순 비율용
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

/** 조회 기준일 이후(당일 포함) 가장 이른 창고입고 예정일(ETA Port + 7일) */
function nextWarehouseReceiptOnOrAfterForSku(inTransitRows, modelName, partNo, asOfDate) {
  let best = null
  for (const t of inTransitRows || []) {
    if (t.modelName !== modelName || t.partNo !== partNo) continue
    if (!isInTransitRowActive(t)) continue
    const r = warehouseReceiptDateFromEtaPort(t)
    if (!r || r < asOfDate) continue
    if (best == null || r < best) best = r
  }
  return best
}

function nextWarehouseReceiptOnOrAfterForModel(inTransitRows, modelName, asOfDate) {
  let best = null
  for (const t of filterByModel(inTransitRows || [], modelName)) {
    if (!isInTransitRowActive(t)) continue
    const r = warehouseReceiptDateFromEtaPort(t)
    if (!r || r < asOfDate) continue
    if (best == null || r < best) best = r
  }
  return best
}

/** startMonday ~ endMonday(포함) 매주 월요일 ISO 목록 */
function inclusiveWeekMondaysFromTo(startMonday, endMonday) {
  if (!startMonday) return []
  if (!endMonday || startMonday > endMonday) return [startMonday]
  const out = []
  for (let d = startMonday; d <= endMonday; d = addDaysIso(d, 7)) {
    out.push(d)
  }
  return out
}

/**
 * 대시보드·마스터 품번별 커버리지:
 * 다음 ETA+7 도착이 속한 주(없으면 고정 N주)까지 기간의 입고·출고 합으로
 * projectedStock / (기간 출고합 / 기간 주수)
 * @returns {number|null} 출고 합 0이면 null (표시 "—")
 */
export function computeArrivalHorizonCoverageWeeksForSku({
  asOfDate,
  warehouseStock,
  modelName,
  partNo,
  deliveryPlans,
  inTransitContainers,
  fallbackPeriodWeeks = FALLBACK_COVERAGE_PERIOD_WEEKS,
}) {
  const startMonday = getWeekRange(asOfDate).start
  const nextReceipt = nextWarehouseReceiptOnOrAfterForSku(
    inTransitContainers,
    modelName,
    partNo,
    asOfDate,
  )

  let endMonday
  if (nextReceipt) {
    endMonday = getWeekRange(nextReceipt).start
    if (endMonday < startMonday) endMonday = startMonday
  } else {
    endMonday = addDaysIso(startMonday, 7 * (fallbackPeriodWeeks - 1))
  }

  const weekMondays = inclusiveWeekMondaysFromTo(startMonday, endMonday)
  const periodWeeks = Math.max(1, weekMondays.length)

  let totalInbound = 0
  let totalOutbound = 0
  for (const mon of weekMondays) {
    totalInbound += inboundQtyForWeek(inTransitContainers, modelName, partNo, mon)
    totalOutbound += outboundPlanQtyForWeek(deliveryPlans, modelName, partNo, mon)
  }

  if (totalOutbound <= 0) return null

  const stock = Math.max(0, Number(warehouseStock) || 0)
  const projectedStock = stock + totalInbound - totalOutbound
  const averageWeeklyDemand = totalOutbound / periodWeeks
  if (averageWeeklyDemand <= 0) return null
  return projectedStock / averageWeeklyDemand
}

/**
 * 선택 모델: 품번 전체 합산 재고·입고·출고, 모델 내 가장 이른 다음 도착일까지(없으면 N주) 동일 식.
 */
export function computePortfolioArrivalHorizonCoverageWeeks({
  masterItems,
  deliveryPlans,
  inTransitContainers,
  asOfDate,
  modelName,
  getWarehouseStockQty,
  fallbackPeriodWeeks = FALLBACK_COVERAGE_PERIOD_WEEKS,
}) {
  const items = (masterItems || []).filter((m) => m.status !== 'Inactive')
  if (!items.length) return null

  const startMonday = getWeekRange(asOfDate).start
  const nextReceipt = nextWarehouseReceiptOnOrAfterForModel(
    inTransitContainers,
    modelName,
    asOfDate,
  )

  let endMonday
  if (nextReceipt) {
    endMonday = getWeekRange(nextReceipt).start
    if (endMonday < startMonday) endMonday = startMonday
  } else {
    endMonday = addDaysIso(startMonday, 7 * (fallbackPeriodWeeks - 1))
  }

  const weekMondays = inclusiveWeekMondaysFromTo(startMonday, endMonday)
  const periodWeeks = Math.max(1, weekMondays.length)

  let totalInbound = 0
  let totalOutbound = 0
  for (const mon of weekMondays) {
    for (const it of items) {
      totalInbound += inboundQtyForWeek(inTransitContainers, it.modelName, it.partNo, mon)
      totalOutbound += outboundPlanQtyForWeek(deliveryPlans, it.modelName, it.partNo, mon)
    }
  }

  if (totalOutbound <= 0) return null

  const initial = items.reduce((s, it) => s + Math.max(0, Number(getWarehouseStockQty(it)) || 0), 0)
  const projectedStock = initial + totalInbound - totalOutbound
  const averageWeeklyDemand = totalOutbound / periodWeeks
  if (averageWeeklyDemand <= 0) return null
  return projectedStock / averageWeeklyDemand
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

  const coverageWeeks = computeArrivalHorizonCoverageWeeksForSku({
    asOfDate,
    warehouseStock,
    modelName: item.modelName,
    partNo: item.partNo,
    deliveryPlans: itemDeliveryPlans,
    inTransitContainers,
  })

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
