/**
 * 메뉴·뷰 권한 (App 네비 view id와 동일한 키)
 * Supabase/Firebase 등으로 교체 시 이 모듈만 서버 스키마에 맞게 조정하면 됩니다.
 */

import { VIEW_LABELS } from '../i18n/labels.js'

/**
 * 네비 표시 순서 (운영: 대시보드 → 창고 → 운송중 → 출고 계획 → 재고 예측 → 설정).
 * Forecast Excel 업로드 뷰는 제외됨. 재도입 시 `VIEW_LABELS`·App 라우트에 `forecast` 추가.
 */
export const VIEW_IDS = [
  'dashboard',
  'master',
  'transit',
  'delivery',
  'projection',
  'settings',
]

export const VIEW_MENU_LABELS = Object.fromEntries(
  VIEW_IDS.map((id) => [id, VIEW_LABELS[id]]),
)

/** 미국 창고·파트너 테스트: 대시보드 + 운송중(입고/이력)만, 설정·원가 UI 없음 */
export const PARTNER_TEST_ROLE = 'PartnerTest'

/** @typedef {{ dashboard?: boolean, master?: boolean, delivery?: boolean, transit?: boolean, projection?: boolean, settings?: boolean }} MenuPermissions */

export function defaultMenuPermissionsForPartnerTest() {
  return {
    dashboard: true,
    master: false,
    delivery: false,
    transit: true,
    projection: false,
    settings: false,
  }
}

/** @param {string} role */
export function defaultMenuPermissionsForRole(role) {
  const all = Object.fromEntries(VIEW_IDS.map((id) => [id, true]))
  const none = Object.fromEntries(VIEW_IDS.map((id) => [id, false]))
  if (isAdminRole(role)) return { ...all }
  switch (role) {
    case 'Admin':
      return { ...all }
    case PARTNER_TEST_ROLE:
      return defaultMenuPermissionsForPartnerTest()
    case 'Manager':
      return {
        ...none,
        dashboard: true,
        master: true,
        delivery: true,
        transit: true,
        projection: true,
      }
    case 'Viewer':
      return {
        ...none,
        dashboard: true,
      }
    default:
      return { ...none }
  }
}

/** @param {string | undefined} role */
export function isAdminRole(role) {
  const r = String(role ?? '').trim().toLowerCase()
  return r === 'admin' || r === 'administrator'
}

export function canAccessView(user, viewId) {
  if (!user || user.active === false) return false
  if (isAdminRole(user.role)) return true
  return !!user.menuPermissions?.[viewId]
}

/** @param {{ role?: string, active?: boolean } | null} user */
export function isAdminUser(user) {
  return !!user && user.active !== false && isAdminRole(user.role)
}

/**
 * 미국 창고·파트너 테스트 계정 — 원격 동기화 PUT 비활성(관리자 외 동일 데이터 조회용)
 */
export function isPartnerTestViewer(user) {
  if (!user || user.active === false) return false
  if (isAdminRole(user.role)) return false
  const role = String(user.role ?? '').trim().toLowerCase()
  if (role === PARTNER_TEST_ROLE.toLowerCase()) return true
  const uid = String(user.userId ?? '').trim().toLowerCase()
  return uid === 'test'
}

/** @param {object} user */
export function sanitizeUserForClient(user) {
  if (!user) return null
  const copy = { ...user }
  delete copy.passwordHash
  delete copy.passwordPlain
  return copy
}
