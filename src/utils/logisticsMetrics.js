/** 물류 운영 KPI · 주차/지연 판단 */

import { formatWeekHeaderShort, isoWeekLabelFromMonday } from './weekIsoLabels'

/** 납품 행의 주 시작일(월요일 YYYY-MM-DD) */
export function planRowWeekStart(row) {
  if (!row) return ''
  const w = row.weekStartDate || row.periodStart
  if (!w || !/^\d{4}-\d{2}-\d{2}$/.test(String(w))) return ''
  return getWeekRange(String(w)).start
}

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
    .filter((row) => {
      const mon = planRowWeekStart(row)
      return mon && mon >= range.start
    })
    .sort((a, b) => planRowWeekStart(a).localeCompare(planRowWeekStart(b)))
}

/**
 * itemDeliveryPlans → 모델별 주차 집계 (주간 납품 qty 합계)
 * 대시보드 표는 plannedQty 필드에 합계를 담고, confirmedQty는 사용하지 않음(null).
 */
export function aggregateItemDeliveryPlansByWeek(itemPlans, modelName, asOfDate) {
  const rows = filterByModel(itemPlans, modelName)
  const future = getFutureDeliveryPlans(rows, asOfDate)
  const map = new Map()

  for (const row of future) {
    const periodStart = planRowWeekStart(row)
    if (!periodStart) continue
    const qty = Number(row.qty ?? row.plannedQty) || 0
    if (!map.has(periodStart)) {
      map.set(periodStart, {
        modelName,
        week: row.week || isoWeekLabelFromMonday(periodStart),
        label: row.label || formatWeekHeaderShort(periodStart),
        periodStart,
        plannedQty: 0,
      })
    }
    const agg = map.get(periodStart)
    agg.plannedQty += qty
  }

  return Array.from(map.values())
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
    .map((row) => ({
      ...row,
      confirmedQty: null,
      status: isThisWeek(row.periodStart, asOfDate) ? 'in_progress' : 'planned',
    }))
}

/** 이번 주(기준일 주간) Part별 납품 합계 — 주간 qty */
export function getThisWeekAggregatedDeliveryQty(itemPlans, modelName, asOfDate) {
  const range = getWeekRange(asOfDate)
  return filterByModel(itemPlans, modelName)
    .filter((row) => {
      const mon = planRowWeekStart(row)
      return mon && isDateInRange(mon, range.start, range.end)
    })
    .reduce((sum, row) => sum + (Number(row.qty ?? row.plannedQty) || 0), 0)
}

/** 모델별 창고(마스터) 재고 수량·금액 */
export function sumWarehouseStockForModel(masterItems, modelName) {
  const rows = filterByModel(masterItems, modelName).filter((r) => r.status !== 'Inactive')
  let qty = 0
  let value = 0
  for (const r of rows) {
    const q = Number(r.currentStock) || 0
    const p = Number(r.unitPrice) || 0
    qty += q
    value += q * p
  }
  return { qty, value }
}

/**
 * 운송중(컨테이너 목록) 수량·금액 — 단가는 masterItems에서 model+part 매칭
 * @param {object[]} containers 이미 모델 등으로 필터된 행
 */
export function sumInTransitStockForContainers(containers, masterItems) {
  const priceMap = new Map()
  for (const m of masterItems) {
    if (m.status === 'Inactive') continue
    priceMap.set(`${m.modelName}\t${m.partNo}`, Number(m.unitPrice) || 0)
  }
  let qty = 0
  let value = 0
  for (const row of containers) {
    if (!isInTransitRowActive(row)) continue
    const q = Number(row.qty) || 0
    const unit = priceMap.get(`${row.modelName}\t${row.partNo}`) || 0
    qty += q
    value += q * unit
  }
  return { qty, value }
}

/** ETA Port 또는 ETA W/H가 기준일보다 이전인 미도착 컨테이너 */
export function isInTransitRowDelayed(row, asOfDate) {
  if (!isInTransitRowActive(row) || !asOfDate) return false
  const etaP = row.etaPort
  if (etaP && /^\d{4}-\d{2}-\d{2}$/.test(String(etaP)) && String(etaP) < asOfDate) return true
  const wh = String(row.etaWh ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(wh) && wh < asOfDate) return true
  return false
}

/** ETA Port 또는 ETA W/H가 기준일보다 이전인 미도착 컨테이너 수 */
export function countDelayedInTransitContainers(containers, asOfDate) {
  return containers.filter((row) => isInTransitRowDelayed(row, asOfDate)).length
}
