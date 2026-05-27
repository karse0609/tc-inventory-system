import { getCoverageStatus, MIN_MANAGEMENT_WEEKS } from '../config/inventoryPolicy'
import { calculateDemandBasedCoverageWeeks } from './inventoryCoverage'
import { addDaysIso, planWeekMonday } from './deliveryPlanHorizon'
import { outboundQtyForSimulation } from './deliveryPlanModel'
import { getWeekRange, isDateInRange, isInTransitRowActive } from './logisticsMetrics'

const PROJECTION_DEBUG =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEBUG_INVENTORY_PROJECTION === 'true'

/** @param {string} weekId e.g. 2026-W20 → W20 */
export function shortWeekLabel(weekId) {
  if (!weekId) return ''
  return String(weekId).replace(/^\d{4}-/i, '')
}

function deliveryQtyForWeek(planRows, modelName, partNo, mondayIso) {
  let sum = 0
  for (const p of planRows) {
    if (p.modelName !== modelName || p.partNo !== partNo) continue
    if (planWeekMonday(p) !== mondayIso) continue
    sum += outboundQtyForSimulation(p)
  }
  return sum
}

/**
 * 운송중 행의 창고 입고 예상일 = ETA Port(YYYY-MM-DD) + 7일.
 * ETA Port가 없거나 형식이 아니면 반영하지 않음.
 */
export function warehouseReceiptDateFromEtaPort(row) {
  const p = String(row?.etaPort ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p)) return ''
  return addDaysIso(p, 7)
}

/** 입고 예정일이 해당 주(월요일 periodStart 기준 월~일) 안에 있으면 그 주 inbound */
function inboundQtyForWeek(transitRows, modelName, partNo, periodStartMonday) {
  const { start, end } = getWeekRange(periodStartMonday)
  let sum = 0
  for (const t of transitRows) {
    if (!isInTransitRowActive(t)) continue
    if (t.modelName !== modelName || t.partNo !== partNo) continue
    const receipt = warehouseReceiptDateFromEtaPort(t)
    if (!receipt) continue
    if (!isDateInRange(receipt, start, end)) continue
    sum += Number(t.qty) || 0
  }
  return sum
}

/** 활성 운송중 수량 합계(주차 무관, 파이프라인 표시용) */
function pipelineQtyForSku(transitRows, modelName, partNo) {
  let sum = 0
  for (const t of transitRows) {
    if (!isInTransitRowActive(t)) continue
    if (t.modelName !== modelName || t.partNo !== partNo) continue
    sum += Number(t.qty) || 0
  }
  return sum
}

/**
 * 품번별 ETA Port + 7일 창고입고일이 속한 주의 월요일(periodStart) 중 가장 늦은 값.
 * 활성 운송중이며 ETA Port가 유효한 행만 고려. 없으면 ''.
 */
export function lastInboundMondayFromTransit(transitRows, modelName, partNo) {
  let maxMonday = ''
  for (const t of transitRows) {
    if (!isInTransitRowActive(t)) continue
    if (t.modelName !== modelName || t.partNo !== partNo) continue
    const receipt = warehouseReceiptDateFromEtaPort(t)
    if (!receipt) continue
    const monday = getWeekRange(receipt).start
    if (monday > maxMonday) maxMonday = monday
  }
  return maxMonday
}

/**
 * @param {object[]} masterItems
 * @param {object[]} deliveryPlans
 * @param {object[]} inTransitRows
 * @param {{ periodStart: string, week: string }[]} weekColumns 시간순
 */
export function buildInventoryProjectionRows(masterItems, deliveryPlans, inTransitRows, weekColumns) {
  const items = masterItems.filter((m) => m.status !== 'Inactive')
  const sortedWeeks = [...weekColumns].sort((a, b) => a.periodStart.localeCompare(b.periodStart))

  return items.map((item) => {
    let projected = Number(item.currentStock) || 0
    const weeks = {}
    const safetyWeeks = Number(item.safetyStockWeeks) || 0
    const leadTimeDays = Number(item.leadTime) || 0
    const masterWeeklyDemand = Number(item.weeklyDemand) || 0
    const inTransitPipeline = pipelineQtyForSku(
      inTransitRows,
      item.modelName,
      item.partNo,
    )

    const lastInboundMonday = lastInboundMondayFromTransit(
      inTransitRows,
      item.modelName,
      item.partNo,
    )

    for (const col of sortedWeeks) {
      const previousStock = projected
      const inbound = inboundQtyForWeek(
        inTransitRows,
        item.modelName,
        item.partNo,
        col.periodStart,
      )
      const outbound = deliveryQtyForWeek(
        deliveryPlans,
        item.modelName,
        item.partNo,
        col.periodStart,
      )
      const weeklyOut = Math.max(outbound, masterWeeklyDemand)

      projected = previousStock + inbound - outbound

      const coverageWeeks = weeklyOut > 0 ? projected / weeklyOut : null
      const safetyWForQty = safetyWeeks > 0 ? safetyWeeks : MIN_MANAGEMENT_WEEKS
      const safetyStockQty = weeklyOut * safetyWForQty
      const gap = projected - safetyStockQty

      /** 대시보드 품번별 재고와 동일: 커버리지(주) 구간만 사용 */
      const covForStatus = calculateDemandBasedCoverageWeeks(projected, weeklyOut)
      const showStatusBadge =
        !!lastInboundMonday && String(col.periodStart).localeCompare(lastInboundMonday) <= 0
      const status = showStatusBadge ? getCoverageStatus(covForStatus) : null

      if (PROJECTION_DEBUG) {
        console.log('[tc-inv projection] cell', {
          model: item.modelName,
          part: item.partNo,
          week: col.week,
          periodStart: col.periodStart,
          previousStock,
          inbound,
          outbound,
          projectedStock: projected,
        })
      }

      weeks[col.periodStart] = {
        weekId: col.week,
        projected,
        coverageWeeks,
        gap,
        safetyStockQty,
        /** ETA Port + 7일이 해당 주에 들어오는 운송중 수량 */
        inbound,
        /** @deprecated 호환: inbound과 동일 */
        arrival: inbound,
        outbound,
        delivery: outbound,
        previousStock,
        weeklyOut,
        /** critical | warning | stable | overstock | null (뱃지 비표시) */
        status,
        lastInboundPeriodStart: lastInboundMonday || null,
      }
    }

    return {
      id: item.id,
      modelName: item.modelName,
      partNo: item.partNo,
      description: item.description ?? '',
      currentStock: Number(item.currentStock) || 0,
      inTransitPipeline,
      safetyStockWeeks: safetyWeeks,
      leadTimeDays,
      lastInboundPeriodStart: lastInboundMonday || null,
      weeks,
    }
  })
}
