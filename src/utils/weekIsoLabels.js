/** 헤더용 M-D (앞자리 0 없음) — weekStartDate(월요일) 기준 */
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
