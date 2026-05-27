import { getCoverageStatus, MIN_MANAGEMENT_WEEKS } from '../config/inventoryPolicy'
import { calculateFlowCoverageWeeks } from './inventoryCoverage'
import { planWeekMonday } from './deliveryPlanHorizon'
import { outboundQtyForSimulation } from './deliveryPlanModel'
import {
  getWeekRange,
  inboundQtyForWeek,
  isInTransitRowActive,
  warehouseReceiptDateFromEtaPort,
} from './logisticsMetrics'

export { warehouseReceiptDateFromEtaPort }

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

    for (let idx = 0; idx < sortedWeeks.length; idx += 1) {
      const col = sortedWeeks[idx]
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

      const futureCols = sortedWeeks.slice(idx + 1)
      const futureFlows = futureCols.map((fc) => ({
        inbound: inboundQtyForWeek(
          inTransitRows,
          item.modelName,
          item.partNo,
          fc.periodStart,
        ),
        outbound: deliveryQtyForWeek(
          deliveryPlans,
          item.modelName,
          item.partNo,
          fc.periodStart,
        ),
      }))
      const coverageWeeks = calculateFlowCoverageWeeks(projected, futureFlows)

      const safetyWForQty = safetyWeeks > 0 ? safetyWeeks : MIN_MANAGEMENT_WEEKS
      const safetyStockQty = weeklyOut * safetyWForQty
      const gap = projected - safetyStockQty

      const covForStatus = coverageWeeks
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
          coverageWeeks,
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
