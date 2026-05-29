/**
 * 인증·사용자 저장 (localStorage)
 * 백엔드 연동 시 이 파일의 저장소 호출부를 API로 교체하면 됩니다.
 */

import {
  defaultMenuPermissionsForRole,
  defaultMenuPermissionsForPartnerTest,
  sanitizeUserForClient,
} from './permissions'

export const AUTH_STORAGE_KEYS = {
  users: 'tc-inv-users',
  sessionUserId: 'tc-inv-session-user-id',
}

/** SHA-256('1234') UTF-8 — 기본 admin 비밀번호 시드용 (Web Crypto와 동일 알고리즘) */
export const ADMIN_DEFAULT_PASSWORD_HASH =
  '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'

export async function hashPassword(plain) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(plain)))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function loadUsersFromStorage() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.users)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** localStorage 저장용: 평문 비밀번호 필드 제거 */
export function usersForPersistence(users) {
  return users.map((u) => {
    const copy = { ...u }
    delete copy.passwordPlain
    return copy
  })
}

/** @param {object[]} users */
export function saveUsersToStorage(users) {
  localStorage.setItem(AUTH_STORAGE_KEYS.users, JSON.stringify(usersForPersistence(users)))
}

export const BUILTIN_ADMIN_USER_ID = 'user-builtin-admin'
export const BUILTIN_PARTNER_TEST_USER_ID = 'user-builtin-partner-test'

export function createDefaultAdminUser() {
  return {
    id: BUILTIN_ADMIN_USER_ID,
    userId: 'admin',
    passwordHash: ADMIN_DEFAULT_PASSWORD_HASH,
    name: 'Administrator',
    role: 'Admin',
    active: true,
    menuPermissions: defaultMenuPermissionsForRole('Admin'),
  }
}

/** 미국 창고·파트너 테스트 — PW 1234 (해시는 admin 기본과 동일) */
export function createDefaultPartnerTestUser() {
  return {
    id: BUILTIN_PARTNER_TEST_USER_ID,
    userId: 'test',
    passwordHash: ADMIN_DEFAULT_PASSWORD_HASH,
    name: 'US Warehouse · Partner (Test)',
    role: 'PartnerTest',
    active: true,
    menuPermissions: defaultMenuPermissionsForPartnerTest(),
  }
}

export function ensureUsersInStorage() {
  let users = loadUsersFromStorage()
  if (!users?.length) {
    users = [createDefaultAdminUser(), createDefaultPartnerTestUser()]
    saveUsersToStorage(users)
    return users
  }
  const hasTestLogin = users.some(
    (u) => String(u.userId ?? '').trim().toLowerCase() === 'test',
  )
  if (!hasTestLogin) {
    users = [...users, createDefaultPartnerTestUser()]
    saveUsersToStorage(users)
  }
  return users
}

export function getSessionUserId() {
  return sessionStorage.getItem(AUTH_STORAGE_KEYS.sessionUserId)
}

export function setSessionUserId(internalId) {
  sessionStorage.setItem(AUTH_STORAGE_KEYS.sessionUserId, internalId)
}

export function clearSession() {
  sessionStorage.removeItem(AUTH_STORAGE_KEYS.sessionUserId)
}

/** 개발용: 인증 관련 localStorage·sessionStorage 전부 제거 후 로그인 화면으로 돌아갈 때 사용 */
export function clearAllAuthStorage() {
  localStorage.removeItem(AUTH_STORAGE_KEYS.users)
  sessionStorage.clear()
}

/**
 * @param {string} userId
 * @param {string} passwordPlain
 * @param {object[]} users
 */
export async function authenticate(userId, passwordPlain, users) {
  const id = String(userId ?? '').trim().toLowerCase()
  const row = users.find((u) => String(u.userId).trim().toLowerCase() === id)
  if (!row || row.active === false) return null
  const hash = await hashPassword(passwordPlain)
  if (hash !== row.passwordHash) return null
  return sanitizeUserForClient(row)
}

/**
 * @param {string} internalUserId
 * @param {object[]} users
 */
export function resolveSessionUser(internalUserId, users) {
  if (!internalUserId) return null
  const row = users.find((u) => u.id === internalUserId)
  if (!row || row.active === false) return null
  return sanitizeUserForClient(row)
}
