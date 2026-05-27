/**
 * 입고 확정(arrival ledger) 취소 시 해당 분을 역산에서 제외하기 위한 플래그 처리.
 * @param {unknown[]} ledger
 * @param {object[]} rows - 입고완료 상태였던 운송중 행
 * @param {{ atIso: string, cancelledBy: string }} meta
 */
export function markArrivalLedgerEntriesCancelled(ledger, rows, meta) {
  if (!Array.isArray(ledger) || !rows?.length) return Array.isArray(ledger) ? [...ledger] : []
  const next = ledger.map((e) => ({ ...(e && typeof e === 'object' ? e : {}) }))
  const usedIds = new Set()

  for (const r of rows) {
    const qty = Math.max(0, Number(r.qty) || 0)
    const model = String(r.modelName ?? '').trim()
    const part = String(r.partNo ?? '').trim()
    const rd = String(r.receiptDate ?? '').trim()
    const rid = String(r.id ?? '').trim()

    let ix = next.findIndex(
      (e) =>
        !e.cancelledAtIso &&
        rid &&
        e.sourceTransitId === rid &&
        !usedIds.has(String(e.id ?? '')),
    )
    if (ix < 0 && model && part && rd) {
      ix = next.findIndex(
        (e) =>
          !e.cancelledAtIso &&
          !usedIds.has(String(e.id ?? '')) &&
          !e.sourceTransitId &&
          String(e.modelName ?? '').trim() === model &&
          String(e.partNo ?? '').trim() === part &&
          String(e.receivedAt ?? '').trim() === rd &&
          Math.max(0, Number(e.qty) || 0) === qty,
      )
    }
    if (ix >= 0) {
      usedIds.add(String(next[ix].id ?? ix))
      next[ix] = {
        ...next[ix],
        cancelledAtIso: meta.atIso,
        cancelledBy: meta.cancelledBy,
      }
    }
  }
  return next
}
