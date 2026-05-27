/** 재고 관리 정책 (주단위) */

/** 최소 관리 기준 — 4주 재고 */
export const MIN_MANAGEMENT_WEEKS = 4

/**
 * 커버리지(주) 구간 — 대시보드 KPI·배지·행 강조와 동일
 * - 2주 미만: 위험(Critical)
 * - 2주 이상 ~ 3주 미만: 주의(Warning)
 * - 3주 이상 ~ 6주 미만: 안정(Stable)
 * - 6주 이상: 과잉(Overstock), 수요 0으로 ∞ 인 경우도 과잉으로 간주
 */
export const COVERAGE_THRESHOLDS = {
  criticalMax: 2,
  warningMax: 3,
  stableMax: 6,
}

/**
 * @returns {'critical' | 'warning' | 'stable' | 'overstock'}
 */
export function getCoverageStatus(coverageWeeks) {
  if (coverageWeeks === Infinity) return 'overstock'
  if (!Number.isFinite(coverageWeeks)) return 'stable'
  if (coverageWeeks < COVERAGE_THRESHOLDS.criticalMax) return 'critical'
  if (coverageWeeks < COVERAGE_THRESHOLDS.warningMax) return 'warning'
  if (coverageWeeks < COVERAGE_THRESHOLDS.stableMax) return 'stable'
  return 'overstock'
}

export function getCoverageStatusLabel(status) {
  const labels = {
    critical: { ko: '위험', en: 'Critical' },
    warning: { ko: '주의', en: 'Warning' },
    stable: { ko: '안정', en: 'Stable' },
    overstock: { ko: '과잉', en: 'Overstock' },
  }
  return labels[status] ?? { ko: status, en: status }
}
