import { getWeekRange } from './logisticsMetrics'
import { formatWeekHeaderShort, isoWeekLabelFromMonday } from './weekIsoLabels'

export { formatWeekHeaderShort, isoWeekLabelFromMonday } from './weekIsoLabels'

/** 해당 날짜/행이 속한 주의 월요일(YYYY-MM-DD) — weekStartDate 우선 */
export function planWeekMonday(planOrPeriodStart) {
  const ps =
    typeof planOrPeriodStart === 'string'
      ? planOrPeriodStart
      : planOrPeriodStart?.weekStartDate || planOrPeriodStart?.periodStart
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

/**
 * @param {string} asOfDate YYYY-MM-DD
 * @param {number} pastWeeks
 * @param {number} futureWeeks
 * @param {number} weekOffsetWeeks 뷰 시작을 앞/뒤로 이동(±주)
 */
export function buildWeekHorizon(asOfDate, pastWeeks = 2, futureWeeks = 22, weekOffsetWeeks = 0) {
  const { start: anchorMonday } = getWeekRange(asOfDate)
  const columns = []
  const total = pastWeeks + futureWeeks + 1
  for (let j = 0; j < total; j += 1) {
    const periodStart = addDaysIso(anchorMonday, (weekOffsetWeeks - pastWeeks + j) * 7)
    columns.push({
      periodStart,
      weekStartDate: periodStart,
      headerShort: formatWeekHeaderShort(periodStart),
      week: isoWeekLabelFromMonday(periodStart),
      label: formatWeekHeaderShort(periodStart),
    })
  }
  return columns
}
