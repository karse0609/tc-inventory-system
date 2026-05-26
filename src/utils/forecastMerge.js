import { newId } from './newId'

function planKey(p) {
  const start = p.periodStart || p.weekStartDate || ''
  return `${p.modelName}__${p.partNo}__${start}`
}

function masterKey(m) {
  return `${m.modelName}__${m.partNo}`
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
    const periodStart = row.periodStart || row.weekStartDate
    if (!periodStart) continue
    const key = planKey({ ...row, periodStart })
    const nextRow = {
      id: map.get(key)?.id ?? newId('plan'),
      modelName: row.modelName,
      partNo: row.partNo,
      week: row.week || map.get(key)?.week || '',
      label: row.label || map.get(key)?.label || '',
      periodStart,
      plannedQty: Number(row.plannedQty) || 0,
      confirmedQty:
        row.confirmedQty !== undefined && row.confirmedQty !== ''
          ? Number(row.confirmedQty)
          : map.get(key)?.confirmedQty ?? null,
      status: row.status || map.get(key)?.status || 'planned',
    }
    map.set(key, nextRow)
    updatedKeys.push(key)
  }

  return {
    next: [...map.values()],
    matched,
    unmatched,
    updatedKeys,
  }
}
