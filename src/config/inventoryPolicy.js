/** 재고 관리 정책 (주단위) */

/** 최소 관리 기준 — 4주 재고 */
export const MIN_MANAGEMENT_WEEKS = 4

/** 커버리지 상태 구간 (주) */
export const COVERAGE_THRESHOLDS = {
  dangerMax: 2, // 2주 미만 → 위험
  cautionMax: 4, // 2주 이상 ~ 4주 미만 → 주의
  // 4주 이상 → 안정
}

export function getCoverageStatus(coverageWeeks) {
  if (!Number.isFinite(coverageWeeks)) return 'stable'
  if (coverageWeeks < COVERAGE_THRESHOLDS.dangerMax) return 'danger'
  if (coverageWeeks < COVERAGE_THRESHOLDS.cautionMax) return 'caution'
  return 'stable'
}

export function getCoverageStatusLabel(status) {
  const labels = {
    danger: { ko: '위험', en: 'Critical' },
    caution: { ko: '주의', en: 'Warning' },
    stable: { ko: '안정', en: 'Stable' },
  }
  return labels[status] ?? { ko: status, en: status }
}
