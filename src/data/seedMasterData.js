import { MIN_MANAGEMENT_WEEKS } from '../config/inventoryPolicy'
import { newId } from '../utils/newId'
import { inventoryItems, itemDeliveryPlans, inTransitContainers } from './logisticsSampleData'

function avgPlannedForPart(partNo, modelName) {
  const rows = itemDeliveryPlans.filter(
    (p) => p.partNo === partNo && p.modelName === modelName,
  )
  if (!rows.length) return 800
  const sum = rows.reduce((s, r) => s + (Number(r.plannedQty) || 0), 0)
  return Math.max(1, Math.round(sum / rows.length))
}

/** Master Data 초기 시드 (화면 직접 입력 전 기본값) */
export function buildSeedMasterItems() {
  return inventoryItems.map((it) => ({
    id: newId(`seed-${it.modelName}-${it.partNo}`),
    modelName: it.modelName,
    partNo: it.partNo,
    description: it.description,
    currentStock: it.currentStock,
    unitPrice: it.unitPrice,
    weeklyDemand: avgPlannedForPart(it.partNo, it.modelName),
    safetyStockWeeks: MIN_MANAGEMENT_WEEKS,
    leadTime: 14,
    status: 'Active',
  }))
}

export function buildSeedDeliveryPlans() {
  return itemDeliveryPlans.map((p, i) => ({
    id: newId(`seed-plan-${i}`),
    modelName: p.modelName,
    partNo: p.partNo,
    week: p.week,
    label: p.label,
    periodStart: p.periodStart,
    plannedQty: p.plannedQty,
    confirmedQty: p.confirmedQty ?? null,
    status: p.status ?? 'planned',
  }))
}

export function buildSeedInTransit() {
  return inTransitContainers.map((row, i) => ({
    id: newId(`seed-tr-${i}`),
    ...row,
  }))
}
