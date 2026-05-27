/**
 * 대시보드 모델 필터 — 창고·운송중·출고계획에 등장하는 modelName 전부 (중복 제거·정렬).
 * @param {{
 *   masterItems?: { modelName?: string }[],
 *   inTransitContainers?: { modelName?: string }[],
 *   deliveryPlans?: { modelName?: string }[],
 * }} sources
 * @returns {string[]}
 */
export function collectOperationalModelNames(sources = {}) {
  const { masterItems = [], inTransitContainers = [], deliveryPlans = [] } = sources
  const set = new Set()
  for (const m of masterItems) {
    const name = String(m?.modelName ?? '').trim()
    if (name) set.add(name)
  }
  for (const r of inTransitContainers) {
    const name = String(r?.modelName ?? '').trim()
    if (name) set.add(name)
  }
  for (const p of deliveryPlans) {
    const name = String(p?.modelName ?? '').trim()
    if (name) set.add(name)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
}
