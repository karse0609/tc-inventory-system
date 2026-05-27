import { getWeekRange } from './logisticsMetrics'
import { newId } from './newId'

function hasLegacyQtyFields(p) {
  if (Object.prototype.hasOwnProperty.call(p, 'plannedQty')) return true
  if (Object.prototype.hasOwnProperty.call(p, 'confirmedQty') && p.shipped === undefined) return true
  return false
}

/**
 * 레거시 납품 계획(Planned/Confirmed/periodStart) → 단순 구조
 * { id, modelName, partNo, weekStartDate, qty, planQty, shipped, confirmedQty, locked? }
 * 동일 SKU·주 병합 시 수량 합산
 */
export function migrateDeliveryPlansToSimple(plans) {
  if (!Array.isArray(plans) || plans.length === 0) return []

  const needsLegacy = plans.some(hasLegacyQtyFields)

  if (!needsLegacy) {
    return plans
      .map((p) => {
        if (!p.modelName || !p.partNo) return null
        const raw = p.weekStartDate || p.periodStart
        if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(String(raw))) return null
        const mon = getWeekRange(String(raw)).start
        const q = Number(p.qty) || 0
        return {
          id: p.id ?? newId('plan'),
          modelName: p.modelName,
          partNo: p.partNo,
          weekStartDate: mon,
          qty: q,
          planQty: q,
          shipped: p.shipped === true,
          confirmedQty: p.shipped === true ? Number(p.confirmedQty ?? p.qty) || 0 : 0,
          locked: p.locked === true,
        }
      })
      .filter(Boolean)
  }

  const merged = new Map()
  for (const p of plans) {
    if (!p.modelName || !p.partNo) continue
    const raw = p.weekStartDate || p.periodStart
    if (!raw) continue
    const mon = getWeekRange(raw).start
    const k = `${p.modelName}\t${p.partNo}\t${mon}`
    const planned = Number(p.plannedQty) || 0
    const c = p.confirmedQty
    const fromOld =
      c != null && c !== '' && !Number.isNaN(Number(c)) ? Number(c) : planned
    const fromQty = Number(p.qty) || 0
    const add = p.weekStartDate != null && p.qty != null ? fromQty : fromOld
    const prev = merged.get(k)
    const sum = (prev?.qty ?? 0) + add
    merged.set(k, {
      id: prev?.id ?? p.id ?? newId('plan'),
      modelName: p.modelName,
      partNo: p.partNo,
      weekStartDate: mon,
      qty: sum,
      planQty: sum,
      shipped: false,
      confirmedQty: 0,
      locked: p.locked === true || prev?.locked === true,
    })
  }
  return [...merged.values()]
}
