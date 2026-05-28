import { parseDateForInput } from './excelGridClipboard'
import { isTransitRowReceived } from './inTransitStatus'

function etdTcSortKey(raw) {
  const iso = parseDateForInput(raw)
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  return ''
}

/**
 * 운송중(미입고) 행: ETD TC 오름차순, 빈 날짜는 맨 아래.
 * 입고 완료 행: receivedAtIso 내림차순(최근 입고 우선).
 */
export function sortInTransitRowsByEtdTc(rows) {
  const active = []
  const received = []
  for (const r of rows || []) {
    if (isTransitRowReceived(r)) received.push(r)
    else active.push(r)
  }

  active.sort((a, b) => {
    const ka = etdTcSortKey(a.etdTcTech)
    const kb = etdTcSortKey(b.etdTcTech)
    if (!ka && !kb) return 0
    if (!ka) return 1
    if (!kb) return -1
    return ka.localeCompare(kb)
  })

  received.sort((a, b) =>
    String(b.receivedAtIso || '').localeCompare(String(a.receivedAtIso || '')),
  )

  return [...active, ...received]
}
