import { MIN_MANAGEMENT_WEEKS } from '../config/inventoryPolicy'
import { planWeekMonday } from './deliveryPlanHorizon'
import { isInTransitRowActive } from './logisticsMetrics'

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
    sum += Number(p.qty ?? p.plannedQty) || 0
  }
  return sum
}

/** ETA W/H (YYYY-MM-DD) → 해당 주 월요일 키, 없으면 '' */
function arrivalMondayFromTransit(row) {
  const raw = row.etaWh
  if (!raw) return ''
  const s = String(raw).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ''
  return planWeekMonday(s)
}

function arrivalQtyForWeek(transitRows, modelName, partNo, mondayIso) {
  let sum = 0
  for (const t of transitRows) {
    if (!isInTransitRowActive(t)) continue
    if (t.modelName !== modelName || t.partNo !== partNo) continue
    if (arrivalMondayFromTransit(t) !== mondayIso) continue
    sum += Number(t.qty) || 0
  }
  return sum
}

/** 활성 운송중 수량 합계(ETA 주차와 무관, 파이프라인 표시용) */
function pipelineQtyForSku(transitRows, modelName, partNo) {
  let sum = 0
  for (const t of transitRows) {
    if (!isInTransitRowActive(t)) continue
    if (t.modelName !== modelName || t.partNo !== partNo) continue
    sum += Number(t.qty) || 0
  }
  return sum
}

function projectionStatusFromPolicy(projected, weeklyOut, safetyWeeks, leadTimeDays) {
  if (weeklyOut <= 0) return 'na'
  const cov = projected / weeklyOut
  if (!Number.isFinite(cov)) return 'na'
  const safetyW =
    safetyWeeks > 0 ? safetyWeeks : MIN_MANAGEMENT_WEEKS
  const leadW = Math.max(0, (Number(leadTimeDays) || 0) / 7)
  if (cov < safetyW) return 'critical'
  if (cov < safetyW + leadW) return 'warning'
  return 'stable'
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

    for (const col of sortedWeeks) {
      const arrival = arrivalQtyForWeek(inTransitRows, item.modelName, item.partNo, col.periodStart)
      const delivery = deliveryQtyForWeek(
        deliveryPlans,
        item.modelName,
        item.partNo,
        col.periodStart,
      )
      const weeklyOut = Math.max(delivery, masterWeeklyDemand)

      projected = projected + arrival - delivery

      const coverageWeeks = weeklyOut > 0 ? projected / weeklyOut : null
      const safetyWForQty = safetyWeeks > 0 ? safetyWeeks : MIN_MANAGEMENT_WEEKS
      const safetyStockQty = weeklyOut * safetyWForQty
      const gap = projected - safetyStockQty

      const status = projectionStatusFromPolicy(
        projected,
        weeklyOut,
        safetyWeeks,
        leadTimeDays,
      )

      weeks[col.periodStart] = {
        weekId: col.week,
        projected,
        coverageWeeks,
        gap,
        safetyStockQty,
        arrival,
        delivery,
        weeklyOut,
        status,
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
      weeks,
    }
  })
}
