/** 물류 운영 KPI · 주차/지연 판단 */

import { ALL_MODELS_VALUE } from '../config/products'
import { isTransitRowReceived } from './inTransitStatus'
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
  if (!modelName || modelName === ALL_MODELS_VALUE) return records
  return records.filter((row) => row.modelName === modelName)
}

/** 도착 예정일: 창고 ETA 우선, 없으면 Port ETA */
export function rowInboundEtaDate(row) {
  const wh = String(row?.etaWh ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(wh)) return wh
  const p = String(row?.etaPort ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return p
  return ''
}

export function isThisWeekInboundEta(row, asOfDate) {
  const d = rowInboundEtaDate(row)
  return !!d && isThisWeek(d, asOfDate)
}

/** 운송중 집계·표시에 포함할 행 (입고 완료·레거시 종료 상태 제외) */
export function isInTransitRowActive(row) {
  if (!row) return false
  if (isTransitRowReceived(row)) return false
  if (row.arrived) return false
  return true
}

/**
 * 과거 조회일 기준 운송중 파이프라인(근사): 아직 미입고이면서,
 * ETD(선적 시작)가 조회일 이후로만 잡히는 행은 당시엔 아직 출발 전으로 제외.
 */
export function isInTransitRowActiveAsOf(row, asOfDate, refDate) {
  if (!isInTransitRowActive(row)) return false
  if (!asOfDate || !refDate || !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate) || !/^\d{4}-\d{2}-\d{2}$/.test(refDate)) {
    return true
  }
  if (asOfDate >= refDate) return true
  const etd = String(row.etdTcTech || row.etdPort || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(etd) && etd > asOfDate) return false
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

  const thisWeekEtaRows = getDashboardEtaPortWindowRows(inTransitContainers, asOfDate)
  const thisWeekEtaQty = thisWeekEtaRows.reduce((sum, row) => sum + (Number(row.qty) || 0), 0)
  const thisWeekEtaContainerCount = (() => {
    const s = new Set()
    for (const row of thisWeekEtaRows) {
      const cn = String(row?.containerNo ?? '').trim()
      if (cn) s.add(cn)
    }
    return s.size
  })()

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
    thisWeekEtaContainerCount,
    thisWeekDeliveryQty,
    currentInventory: inventorySummary?.totalStock ?? 0,
    coverageWeeks:
      inventorySummary?.portfolioCoverageWeeks ??
      inventorySummary?.minCoverageWeeks ??
      null,
    totalInventoryValue: inventorySummary?.totalInventoryValue ?? 0,
    modelWeeklyDemandTotal,
    weekRange,
  }
}

export function getThisWeekEtaRows(containers, asOfDate) {
  return getDashboardEtaPortWindowRows(containers, asOfDate)
}

/** ETA Port만 사용 (YYYY-MM-DD) */
export function etaPortDateOnly(row) {
  const p = String(row?.etaPort ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(p) ? p : ''
}

/**
 * 대시보드「이번주 도착 예정」·KPI「이번주 ETA 수량」:
 * Port ETA(YYYY-MM-DD)가 있고, 조회 기준일 이전·당일이며, 아직 입고 완료되지 않은 운송중 행만.
 */
export function getDashboardEtaPortWindowRows(containers, asOfDate) {
  if (!asOfDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(asOfDate))) return []
  return (containers || [])
    .filter(isInTransitRowActive)
    .filter((row) => {
      const etaP = etaPortDateOnly(row)
      if (!etaP) return false
      return etaP <= asOfDate
    })
    .sort((a, b) => etaPortDateOnly(a).localeCompare(etaPortDateOnly(b)))
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

/** deliveryPlanHorizon.addDaysIso와 동일 로직 (순환 import 방지) */
function addDaysIsoLocal(isoDateStr, deltaDays) {
  const [y, m, d] = String(isoDateStr)
    .split('-')
    .map(Number)
  const dt = new Date(y, m - 1, d + deltaDays, 12, 0, 0, 0)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * 운송중 행의 창고 입고 예상일 = ETA Port(YYYY-MM-DD) + 7일.
 * ETA Port가 없거나 형식이 아니면 반환하지 않음.
 */
export function warehouseReceiptDateFromEtaPort(row) {
  const p = String(row?.etaPort ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p)) return ''
  return addDaysIsoLocal(p, 7)
}

/**
 * 입고 예정일(ETA Port + 7일)이 해당 주(월요일 periodStart 기준 월~일) 안에 들어오는 활성 운송중 수량.
 */
export function inboundQtyForWeek(transitRows, modelName, partNo, periodStartMonday) {
  const { start, end } = getWeekRange(periodStartMonday)
  let sum = 0
  for (const t of transitRows || []) {
    if (!isInTransitRowActive(t)) continue
    if (t.modelName !== modelName || t.partNo !== partNo) continue
    const receipt = warehouseReceiptDateFromEtaPort(t)
    if (!receipt) continue
    if (!isDateInRange(receipt, start, end)) continue
    sum += Number(t.qty) || 0
  }
  return sum
}

/**
 * 조회 기준일이 속한 주의 월요일부터, 출고계획·입고예정(ETA+7)이 존재하는 미래 주차 월요일 목록(시간순).
 * @param {{ modelName?: string, partNo?: string } | null} sku — null이면 modelName 범위 내 전체 품번
 */
export function collectFutureFlowWeekMondays(
  deliveryPlans,
  inTransitContainers,
  asOfDate,
  modelName,
  sku = null,
) {
  const range = getWeekRange(asOfDate)
  const weeks = new Set()

  for (const p of filterByModel(deliveryPlans || [], modelName)) {
    if (sku && (p.modelName !== sku.modelName || p.partNo !== sku.partNo)) continue
    const mon = planRowWeekStart(p)
    if (mon && mon >= range.start) weeks.add(mon)
  }
  for (const t of filterByModel(inTransitContainers || [], modelName)) {
    if (sku && (t.modelName !== sku.modelName || t.partNo !== sku.partNo)) continue
    if (!isInTransitRowActive(t)) continue
    const receipt = warehouseReceiptDateFromEtaPort(t)
    if (!receipt) continue
    const mon = getWeekRange(receipt).start
    if (mon && mon >= range.start) weeks.add(mon)
  }
  return [...weeks].sort((a, b) => a.localeCompare(b))
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

/** 모델별 창고(마스터) 재고 수량·금액(KRW) — 금액은 Settings 원가 맵 기준 */
export function sumWarehouseStockForModel(masterItems, modelName, unitCostKrwBySku) {
  const rows = filterByModel(masterItems, modelName).filter((r) => r.status !== 'Inactive')
  let qty = 0
  let value = 0
  for (const r of rows) {
    const q = Number(r.currentStock) || 0
    const cost =
      unitCostKrwBySku && typeof unitCostKrwBySku === 'object'
        ? Math.max(0, Number(unitCostKrwBySku[`${r.modelName}\t${r.partNo}`]) || 0)
        : 0
    qty += q
    value += q * cost
  }
  return { qty, value }
}

/**
 * 운송중(컨테이너 목록) 수량·금액(KRW) — 단가는 Settings 원가 맵(model+part 키)
 * @param {object[]} containers 이미 모델 등으로 필터된 행
 * @param {Record<string, number>} unitCostKrwBySku
 */
export function sumInTransitStockForContainers(containers, unitCostKrwBySku) {
  const map = unitCostKrwBySku && typeof unitCostKrwBySku === 'object' ? unitCostKrwBySku : {}
  let qty = 0
  let value = 0
  for (const row of containers) {
    if (!isInTransitRowActive(row)) continue
    const q = Number(row.qty) || 0
    const cost = Math.max(0, Number(map[`${row.modelName}\t${row.partNo}`]) || 0)
    qty += q
    value += q * cost
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
