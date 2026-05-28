import { cloneJson, dataEqualJson } from './draftState'

/** 운송중 draft ↔ 저장본 동일 여부 (JSON 비교) */
export function cloneInTransitRows(rows) {
  return cloneJson(rows ?? [])
}

export function inTransitRowsEqual(a, b) {
  return dataEqualJson(a ?? [], b ?? [])
}
