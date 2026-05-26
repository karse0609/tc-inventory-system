/**
 * 메뉴·뷰 권한 (App 네비 view id와 동일한 키)
 * Supabase/Firebase 등으로 교체 시 이 모듈만 서버 스키마에 맞게 조정하면 됩니다.
 */

import { VIEW_LABELS, formatKoEn } from '../i18n/labels.js'

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
  VIEW_IDS.map((id) => [id, formatKoEn(VIEW_LABELS[id])]),
)

/** @typedef {{ dashboard?: boolean, master?: boolean, delivery?: boolean, transit?: boolean, projection?: boolean, settings?: boolean }} MenuPermissions */

/** @param {string} role */
export function defaultMenuPermissionsForRole(role) {
  const all = Object.fromEntries(VIEW_IDS.map((id) => [id, true]))
  const none = Object.fromEntries(VIEW_IDS.map((id) => [id, false]))
  switch (role) {
    case 'Admin':
      return { ...all }
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

/**
 * @param {{ role?: string, active?: boolean, menuPermissions?: MenuPermissions } | null} user
 * @param {string} viewId
 */
export function canAccessView(user, viewId) {
  if (!user || user.active === false) return false
  if (user.role === 'Admin') return true
  return !!user.menuPermissions?.[viewId]
}

/** @param {{ role?: string } | null} user */
export function isAdminUser(user) {
  return user?.role === 'Admin' && user?.active !== false
}

/** @param {object} user */
export function sanitizeUserForClient(user) {
  if (!user) return null
  const copy = { ...user }
  delete copy.passwordHash
  delete copy.passwordPlain
  return copy
}
