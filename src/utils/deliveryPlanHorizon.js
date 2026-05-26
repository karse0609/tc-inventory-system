import { getWeekRange } from './logisticsMetrics'

/** 해당 날짜가 속한 주의 월요일(YYYY-MM-DD) — 컬럼 키 */
export function planWeekMonday(planOrPeriodStart) {
  const ps =
    typeof planOrPeriodStart === 'string'
      ? planOrPeriodStart
      : planOrPeriodStart?.periodStart
  if (!ps) return ''
  return getWeekRange(ps).start
}

export function addDaysIso(isoDateStr, deltaDays) {
  const [y, m, d] = isoDateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + deltaDays, 12, 0, 0, 0)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** 헤더용 M-D (앞자리 0 없음) */
export function formatWeekHeaderShort(mondayIso) {
  const [, m, d] = mondayIso.split('-').map(Number)
  return `${m}-${d}`
}

/**
 * ISO 8601 주차 (YYYY-Www) — 월요일이 속한 ISO 주
 * (PHP date('o-\WW') 와 동일한 흔한 구현)
 */
export function isoWeekLabelFromMonday(mondayIso) {
  const simple = new Date(`${mondayIso}T12:00:00`)
  const date = new Date(simple.getTime())
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const week1 = new Date(date.getFullYear(), 0, 4)
  const week =
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
    )
  const isoYear = date.getFullYear()
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

/**
 * @param {string} asOfDate YYYY-MM-DD
 * @param {number} pastWeeks 이전으로 몇 주
 * @param {number} futureWeeks 이후로 몇 주 (당주 포함 시 +1은 호출부에서)
 */
export function buildWeekHorizon(asOfDate, pastWeeks = 2, futureWeeks = 22) {
  const { start: anchorMonday } = getWeekRange(asOfDate)
  const columns = []
  for (let i = -pastWeeks; i <= futureWeeks; i += 1) {
    const periodStart = addDaysIso(anchorMonday, i * 7)
    columns.push({
      periodStart,
      headerShort: formatWeekHeaderShort(periodStart),
      week: isoWeekLabelFromMonday(periodStart),
      label: formatWeekHeaderShort(periodStart),
    })
  }
  return columns
}
