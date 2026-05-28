/** 운송중 draft ↔ 저장본 동일 여부 (JSON 비교) */
export function cloneInTransitRows(rows) {
  return (rows || []).map((r) => ({ ...r }))
}

export function inTransitRowsEqual(a, b) {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? [])
}
