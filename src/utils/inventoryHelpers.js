import { PILOT_MODEL_NAME } from '../config/products'

/** 레코드에 modelName 보장 (다품목 확장) */
export function withModelName(records, modelName = PILOT_MODEL_NAME) {
  return records.map((row) => ({
    ...row,
    modelName: row.modelName ?? modelName,
  }))
}

/** 기준일: 진행 주차 시작일 → 마지막 주차 → 메타 기준일 → 오늘 */
export function resolveAsOfDate(series, fallbackDate) {
  const current = series.find((row) => row.status === 'current')
  if (current?.periodStart) return current.periodStart

  const lastWithDate = [...series].reverse().find((row) => row.periodStart)
  if (lastWithDate?.periodStart) return lastWithDate.periodStart

  if (fallbackDate) return fallbackDate

  return new Date().toISOString().slice(0, 10)
}

export function formatAsOfDisplay(isoDate, timezone = 'Asia/Seoul') {
  try {
    const formatted = new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'full',
      timeZone: timezone,
    }).format(new Date(`${isoDate}T12:00:00`))
    return formatted
  } catch {
    return isoDate
  }
}
