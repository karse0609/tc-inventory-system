/**
 * 모델명 정규화 · 운영 모델 판별 (대시보드 필터·엑셀 import 공통)
 */

/** 대시보드 드롭다운에서 제외할 정규화된 모델명 (오타·임시값) */
const BLOCKED_NORMALIZED_MODELS = new Set([
  '-',
  'TEST',
  'TEMP',
  /** ML and Redmond 시트 model 열 오타로 유입되는 값 */
  'Z45 I',
])

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeModel(value) {
  if (value == null) return ''
  const s = String(value).trim().replace(/\s+/g, ' ')
  return s ? s.toUpperCase() : ''
}

/**
 * @param {string} normalized — normalizeModel 결과
 */
export function isOperationalModelName(normalized) {
  if (!normalized) return false
  if (BLOCKED_NORMALIZED_MODELS.has(normalized)) return false
  return true
}

/**
 * @param {unknown} a
 * @param {unknown} b
 */
export function modelsMatch(a, b) {
  return normalizeModel(a) === normalizeModel(b)
}

export function hasMasterWarehouseRow(item) {
  if (!item || item.status === 'Inactive') return false
  const model = normalizeModel(item.modelName)
  if (!isOperationalModelName(model)) return false
  return Boolean(String(item.partNo ?? '').trim())
}

export function hasInTransitOperationalRow(row) {
  const model = normalizeModel(row?.modelName)
  if (!isOperationalModelName(model)) return false
  const part = String(row?.partNo ?? '').trim()
  const container = String(row?.containerNo ?? '').trim()
  if (!part && !container) return false
  if ((Number(row?.qty) || 0) > 0) return true
  if (part) return true
  return Boolean(container)
}

export function hasDeliveryPlanOperationalRow(plan) {
  const model = normalizeModel(plan?.modelName)
  if (!isOperationalModelName(model)) return false
  return Boolean(String(plan?.partNo ?? '').trim())
}

/**
 * 비정상 modelName이 어느 배열에서 왔는지 추적 (디버그·데이터 정리용)
 * @returns {{ raw: string, normalized: string, sources: string[] }[]}
 */
export function auditNonOperationalModels(sources = {}) {
  const { masterItems = [], inTransitContainers = [], deliveryPlans = [] } = sources
  const hits = new Map()

  const note = (raw, source) => {
    const normalized = normalizeModel(raw)
    if (!raw || (normalized && isOperationalModelName(normalized))) return
    const key = `${String(raw)} → ${normalized || '(empty)'}`
    const entry = hits.get(key) ?? { raw: String(raw), normalized, sources: [] }
    if (!entry.sources.includes(source)) entry.sources.push(source)
    hits.set(key, entry)
  }

  for (const m of masterItems) note(m?.modelName, 'masterItems')
  for (const r of inTransitContainers) note(r?.modelName, 'inTransitContainers')
  for (const p of deliveryPlans) note(p?.modelName, 'deliveryPlans')

  return [...hits.values()]
}
