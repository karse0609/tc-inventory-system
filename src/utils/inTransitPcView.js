import { isTransitRowReceived } from './inTransitStatus'

/**
 * PC In-Transit 화면 기본(Active) 탭과 동일한 행 집합 — 미입고(입고완료 아님)만.
 * @param {unknown[]} inTransit
 */
export function getInTransitPcActiveViewRows(inTransit) {
  return (inTransit || []).filter((r) => !isTransitRowReceived(r))
}
