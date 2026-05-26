/**
 * Excel ↔ Grid: TSV 파싱/직렬화, 날짜·숫자 보정
 */

/** 클립보드 텍스트 → 행×열 (탭/줄바꿈 기준) */
export function splitTsvToMatrix(text) {
  if (text == null || text === '') return []
  const normalized = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  while (lines.length && lines[lines.length - 1] === '') lines.pop()
  return lines.map((line) => line.split('\t').map((c) => (c == null ? '' : String(c))))
}

export function matrixToTsv(matrix) {
  return matrix.map((row) => row.join('\t')).join('\n')
}

/** Excel 날짜 직렬값(대략 30000~60000) → YYYY-MM-DD (UTC 1899-12-30 기준) */
export function excelSerialToIsoDate(serial) {
  const n = Math.floor(Number(serial))
  if (!Number.isFinite(n) || n < 20000 || n > 80000) return ''
  const epoch = Date.UTC(1899, 11, 30)
  const d = new Date(epoch + n * 86400000)
  return d.toISOString().slice(0, 10)
}

/**
 * 셀 문자열 → type="date"용 YYYY-MM-DD (실패 시 '')
 * - 이미 YYYY-MM-DD
 * - M/D/YYYY, YYYY/M/D
 * - Excel 직렬 숫자 문자열
 */
export function parseDateForInput(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const plainNum = s.replace(/,/g, '')
  if (/^-?\d+\.?\d*$/.test(plainNum)) {
    const n = Number(plainNum)
    if (Number.isFinite(n)) {
      const iso = excelSerialToIsoDate(n)
      if (iso) return iso
    }
  }
  const m1 = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/)
  if (m1) {
    const y = m1[1]
    const mo = String(m1[2]).padStart(2, '0')
    const da = String(m1[3]).padStart(2, '0')
    return `${y}-${mo}-${da}`
  }
  const m2 = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (m2) {
    const mo = String(m2[1]).padStart(2, '0')
    const da = String(m2[2]).padStart(2, '0')
    const y = m2[3]
    return `${y}-${mo}-${da}`
  }
  return ''
}

/** 숫자 셀: 천단위 콤마 제거, NaN 시 null + error */
export function parseQtyCell(raw) {
  const s = String(raw ?? '').trim()
  if (s === '') return { ok: true, value: 0, empty: true }
  const cleaned = s.replace(/,/g, '').replace(/\s/g, '')
  if (cleaned === '') return { ok: true, value: 0, empty: true }
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return { ok: false, value: 0, empty: false, error: 'not_a_number' }
  return { ok: true, value: n, empty: false }
}

export function parseBoolCell(raw) {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return false
  return ['1', 'true', 'y', 'yes', 'o', 'on', 'x', 'v'].includes(s)
}

export async function readClipboardText() {
  try {
    if (navigator.clipboard?.readText) return await navigator.clipboard.readText()
  } catch {
    /* 권한 거부 등 */
  }
  return ''
}

export async function writeClipboardText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.left = '-9999px'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
}
