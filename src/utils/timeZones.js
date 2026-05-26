/**
 * 운영 기준 타임존: America/Los_Angeles(Seattle), Asia/Seoul(KST)
 */

/** @returns {string} YYYY-MM-DD (Asia/Seoul 달력 기준) — 조회 기준일·역산 앵커 */
export function getKoreaCalendarDate(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(now)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  if (!y || !m || !d) return now.toISOString().slice(0, 10)
  return `${y}-${m}-${d}`
}

/** @returns {string} YYYY-MM-DD (America/Los_Angeles 달력 기준) */
export function getSeattleCalendarDate(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(now)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  if (!y || !m || !d) return now.toISOString().slice(0, 10)
  return `${y}-${m}-${d}`
}

/** 타임존 기준 날짜+시각 (YYYY-MM-DD HH:mm, 24h) */
export function formatZonedDateTime(timeZone, now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(now)
    .replace(/\s+/g, ' ')
    .trim()
}

/** 한국 시각 문자열 (YYYY-MM-DD HH:mm, 24h) */
export function formatKstDateTime(now = new Date()) {
  return formatZonedDateTime('Asia/Seoul', now)
}

export function formatSeattleDateTime(now = new Date()) {
  return formatZonedDateTime('America/Los_Angeles', now)
}

/** ISO 날짜 + 일수 (로컬 정오 기준, DST 안전) */
export function addCalendarDaysIso(isoDate, days) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate))) return ''
  const d = new Date(`${isoDate}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
