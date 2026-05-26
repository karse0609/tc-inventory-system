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

    for (const col of sortedWeeks) {
      const arrival = arrivalQtyForWeek(inTransitRows, item.modelName, item.partNo, col.periodStart)
      const delivery = deliveryQtyForWeek(
        deliveryPlans,
        item.modelName,
        item.partNo,
        col.periodStart,
      )
      const safetyW = Number(item.safetyStockWeeks) || 0

      projected = projected + arrival - delivery

      const coverageWeeks = delivery > 0 ? projected / delivery : null
      const safetyStockQty = delivery * safetyW
      const gap = projected - safetyStockQty

      let status = 'na'
      if (coverageWeeks != null && Number.isFinite(coverageWeeks)) {
        if (coverageWeeks < 2) status = 'critical'
        else if (coverageWeeks < 4) status = 'warning'
        else status = 'stable'
      }

      weeks[col.periodStart] = {
        weekId: col.week,
        projected,
        coverageWeeks,
        gap,
        safetyStockQty,
        arrival,
        delivery,
        status,
      }
    }

    return {
      id: item.id,
      modelName: item.modelName,
      partNo: item.partNo,
      description: item.description ?? '',
      currentStock: Number(item.currentStock) || 0,
      safetyStockWeeks: Number(item.safetyStockWeeks) || 0,
      weeks,
    }
  })
}
