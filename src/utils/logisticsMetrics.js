/** 물류 운영 KPI · 주차/지연 판단 */

export function getWeekRange(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`)
  const day = date.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + mondayOffset)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  }
}

export function isDateInRange(dateStr, start, end) {
  if (!dateStr) return false
  return dateStr >= start && dateStr <= end
}

export function isThisWeek(dateStr, asOfDate) {
  const range = getWeekRange(asOfDate)
  return isDateInRange(dateStr, range.start, range.end)
}

export function isToday(dateStr, asOfDate) {
  return dateStr === asOfDate
}

export function filterByModel(records, modelName) {
  return records.filter((row) => row.modelName === modelName)
}

/** 운송중 집계·표시에 포함할 행 (입고 완료·레거시 종료 상태 제외) */
export function isInTransitRowActive(row) {
  if (!row) return false
  if (row.arrived) return false
  if (['Delivered', 'Arrived'].includes(row.status)) return false
  return true
}

export function sumWeeklyDemandForModel(masterItems, modelName) {
  return filterByModel(masterItems, modelName)
    .filter((row) => row.status !== 'Inactive')
    .reduce((sum, row) => sum + (Number(row.weeklyDemand) || 0), 0)
}

export function buildTodayStatus({
  asOfDate,
  todayShipments,
  inTransitContainers,
  itemDeliveryPlans,
  modelName,
  inventorySummary,
  masterItems = [],
}) {
  const weekRange = getWeekRange(asOfDate)

  const todayShipmentQty = todayShipments
    .filter((row) => isToday(row.etdTcTech, asOfDate))
    .reduce((sum, row) => sum + row.qty, 0)

  const inTransit = inTransitContainers.filter(isInTransitRowActive)
  const inTransitQty = inTransit.reduce((sum, row) => sum + row.qty, 0)

  const thisWeekEtaRows = inTransitContainers.filter(
    (row) => isInTransitRowActive(row) && isThisWeek(row.etaPort, asOfDate),
  )
  const thisWeekEtaQty = thisWeekEtaRows.reduce((sum, row) => sum + row.qty, 0)

  const thisWeekDeliveryQty = getThisWeekAggregatedDeliveryQty(
    itemDeliveryPlans,
    modelName,
    asOfDate,
  )

  const modelWeeklyDemandTotal = sumWeeklyDemandForModel(masterItems, modelName)

  return {
    todayShipmentQty,
    inTransitCount: inTransit.length,
    inTransitQty,
    thisWeekEtaCount: thisWeekEtaRows.length,
    thisWeekEtaQty,
    thisWeekDeliveryQty,
    currentInventory: inventorySummary?.totalStock ?? 0,
    coverageWeeks: inventorySummary?.minCoverageWeeks ?? 0,
    totalInventoryValue: inventorySummary?.totalInventoryValue ?? 0,
    modelWeeklyDemandTotal,
    weekRange,
  }
}

export function getThisWeekEtaRows(containers, asOfDate) {
  return containers
    .filter(isInTransitRowActive)
    .filter((row) => isThisWeek(row.etaPort, asOfDate))
    .sort((a, b) => String(a.etaPort).localeCompare(String(b.etaPort)))
}

export function getFutureDeliveryPlans(plans, asOfDate) {
  const range = getWeekRange(asOfDate)
  return plans
    .filter((row) => row.periodStart >= range.start)
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
}

/**
 * itemDeliveryPlans → 모델별 주차 집계 (Planned / Confirmed 합계)
 * Confirmed: 값이 있는 행만 합산; 전부 null이면 null
 */
export function aggregateItemDeliveryPlansByWeek(itemPlans, modelName, asOfDate) {
  const rows = filterByModel(itemPlans, modelName)
  const future = getFutureDeliveryPlans(rows, asOfDate)
  const map = new Map()

  for (const row of future) {
    const key = row.week
    if (!map.has(key)) {
      map.set(key, {
        modelName,
        week: row.week,
        label: row.label,
        periodStart: row.periodStart,
        plannedQty: 0,
        confirmedSum: 0,
        confirmedParts: 0,
        totalParts: 0,
      })
    }
    const agg = map.get(key)
    agg.plannedQty += Number(row.plannedQty) || 0
    agg.totalParts += 1
    if (row.confirmedQty != null && row.confirmedQty !== '') {
      agg.confirmedSum += Number(row.confirmedQty) || 0
      agg.confirmedParts += 1
    }
  }

  return Array.from(map.values())
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
    .map((agg) => ({
      modelName: agg.modelName,
      week: agg.week,
      label: agg.label,
      periodStart: agg.periodStart,
      plannedQty: agg.plannedQty,
      confirmedQty:
        agg.confirmedParts === 0 ? null : agg.confirmedSum,
      status: 'planned',
    }))
    .map((row) => ({
      ...row,
      status: isThisWeek(row.periodStart, asOfDate) ? 'in_progress' : 'planned',
    }))
}

/** 이번 주(기준일 주간) Part별 납품 합계 — 확정 우선, 없으면 계획 */
export function getThisWeekAggregatedDeliveryQty(itemPlans, modelName, asOfDate) {
  const range = getWeekRange(asOfDate)
  return filterByModel(itemPlans, modelName)
    .filter((row) => isDateInRange(row.periodStart, range.start, range.end))
    .reduce((sum, row) => {
      const planned = Number(row.plannedQty) || 0
      const confirmed =
        row.confirmedQty != null && row.confirmedQty !== ''
          ? Number(row.confirmedQty)
          : null
      return sum + (confirmed ?? planned)
    }, 0)
}
