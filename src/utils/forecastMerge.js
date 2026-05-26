import { getWeekRange } from './logisticsMetrics'
import { migrateDeliveryPlansToSimple } from './deliveryPlanMigrate'
import { newId } from './newId'

function planKey(p) {
  const raw = p.weekStartDate || p.periodStart || ''
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(String(raw))) {
    return `${p.modelName}__${p.partNo}__`
  }
  const mon = getWeekRange(String(raw)).start
  return `${p.modelName}__${p.partNo}__${mon}`
}

function masterKey(m) {
  return `${m.modelName}__${m.partNo}`
}

function rowQty(row) {
  if (row.qty != null && row.qty !== '') return Number(row.qty) || 0
  const planned = Number(row.plannedQty) || 0
  const c = row.confirmedQty
  if (c != null && c !== '' && !Number.isNaN(Number(c))) return planned + Number(c)
  return planned
}

/**
 * Excel에서 파싱된 행 중 Master에 존재하는 Part만 납품 계획에 반영합니다.
 * 신규 Part는 적용하지 않습니다(마스터에 먼저 등록).
 * @returns {{ next: object[], matched: object[], unmatched: object[], updatedKeys: string[] }}
 */
export function buildForecastApplyPreview(existingPlans, parsedRows, masterItems) {
  const masterKeys = new Set(
    masterItems.filter((m) => m.status !== 'Inactive').map(masterKey),
  )

  const matched = []
  const unmatched = []
  for (const row of parsedRows) {
    const mk = masterKey(row)
    if (masterKeys.has(mk)) matched.push(row)
    else unmatched.push(row)
  }

  const map = new Map()
  for (const p of existingPlans) {
    map.set(planKey(p), { ...p })
  }

  const updatedKeys = []
  for (const row of matched) {
    const raw = row.weekStartDate || row.periodStart
    if (!raw) continue
    const periodStart = getWeekRange(String(raw)).start
    const key = planKey({ ...row, weekStartDate: periodStart })
    const prev = map.get(key)
    const qty = rowQty(row)
    const nextRow = {
      id: prev?.id ?? newId('plan'),
      modelName: row.modelName,
      partNo: row.partNo,
      weekStartDate: periodStart,
      qty,
      locked: prev?.locked === true,
    }
    map.set(key, nextRow)
    updatedKeys.push(key)
  }

  return {
    next: migrateDeliveryPlansToSimple([...map.values()]),
    matched,
    unmatched,
    updatedKeys,
  }
}
