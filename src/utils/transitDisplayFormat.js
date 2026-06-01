import { parseDateForInput } from './excelGridClipboard'

/** ETA W/H·이력: 가능하면 YYYY-MM-DD로 표시 (PC In-Transit 그리드와 동일) */
export function formatEtaWhDisplay(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  const iso = parseDateForInput(s)
  return iso || s
}
