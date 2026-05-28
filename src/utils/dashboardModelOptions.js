/**
 * 대시보드 모델 필터 — 창고·운송중·출고계획에 실제 데이터가 있는 운영 모델만 (정규화·중복 제거).
 * @param {{
 *   masterItems?: { modelName?: string, partNo?: string, status?: string }[],
 *   inTransitContainers?: { modelName?: string, partNo?: string, qty?: number, containerNo?: string }[],
 *   deliveryPlans?: { modelName?: string, partNo?: string }[],
 * }} sources
 * @returns {string[]}
 */
import {
  hasDeliveryPlanOperationalRow,
  hasInTransitOperationalRow,
  hasMasterWarehouseRow,
  isOperationalModelName,
  normalizeModel,
} from './modelName'

export function collectOperationalModelNames(sources = {}) {
  const { masterItems = [], inTransitContainers = [], deliveryPlans = [] } = sources
  const set = new Set()

  for (const m of masterItems) {
    if (!hasMasterWarehouseRow(m)) continue
    const name = normalizeModel(m.modelName)
    if (isOperationalModelName(name)) set.add(name)
  }
  for (const r of inTransitContainers) {
    if (!hasInTransitOperationalRow(r)) continue
    const name = normalizeModel(r.modelName)
    if (isOperationalModelName(name)) set.add(name)
  }
  for (const p of deliveryPlans) {
    if (!hasDeliveryPlanOperationalRow(p)) continue
    const name = normalizeModel(p.modelName)
    if (isOperationalModelName(name)) set.add(name)
  }

  return [...set].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
}

export { normalizeModel } from './modelName'
