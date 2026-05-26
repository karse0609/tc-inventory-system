/**
 * 메뉴·뷰 권한 (App 네비 view id와 동일한 키)
 * Supabase/Firebase 등으로 교체 시 이 모듈만 서버 스키마에 맞게 조정하면 됩니다.
 */

export const VIEW_IDS = ['dashboard', 'master', 'delivery', 'transit', 'forecast', 'settings']

export const VIEW_MENU_LABELS = {
  dashboard: 'Dashboard',
  master: 'Master Data',
  delivery: 'Delivery Plan',
  transit: 'In-Transit',
  forecast: 'Forecast Upload',
  settings: 'Settings',
}

/** @typedef {{ dashboard?: boolean, master?: boolean, delivery?: boolean, transit?: boolean, forecast?: boolean, settings?: boolean }} MenuPermissions */

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
