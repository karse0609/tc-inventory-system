import { AUTH_STORAGE_KEYS, saveUsersToStorage } from './auth'
import { saveJson, storageKeys } from './appPersistence'
import { operationsMeta as defaultOpsMeta } from '../data/logisticsSampleData'
import { migrateDeliveryPlansToSimple } from './deliveryPlanMigrate'
import { migrateInTransitRows } from './inTransitMigrate'
import { getKoreaCalendarDate } from './timeZones'

export const APP_DATA_EXPORT_VERSION = 1

/**
 * 현재 앱 상태 → 백업 JSON payload (키는 localStorage 키와 동일)
 * @param {{
 *   masterItems: unknown[]
 *   deliveryPlans: unknown[]
 *   inTransit: unknown[]
 *   opsMeta: object
 *   weeklyPlans: unknown[]
 *   startingInventory: number
 *   dataSimSource: unknown
 *   unitCostKrwBySku: object
 *   arrivalLedger: unknown[]
 *   receiptCancelLedger: unknown[]
 *   users?: unknown[]
 * }} state
 */
export function buildAppDataSnapshot(state) {
  return {
    [storageKeys.master]: state.masterItems,
    [storageKeys.plans]: state.deliveryPlans,
    [storageKeys.transit]: state.inTransit,
    [storageKeys.ops]: state.opsMeta,
    [storageKeys.weekly]: state.weeklyPlans,
    [storageKeys.starting]: state.startingInventory,
    [storageKeys.simSource]: state.dataSimSource,
    [storageKeys.unitCostsKrw]: state.unitCostKrwBySku,
    [storageKeys.arrivalLedger]: state.arrivalLedger,
    [storageKeys.receiptCancelLedger]: state.receiptCancelLedger,
    ...(Array.isArray(state.users) ? { [AUTH_STORAGE_KEYS.users]: state.users } : {}),
  }
}

/**
 * @param {unknown} raw - 파일 전체 또는 { payload } 형태
 * @returns {{ patch: object } | { error: string }}
 */
export function parseAppDataImport(raw) {
  if (!raw || typeof raw !== 'object') {
    return { error: 'JSON이 비어 있거나 객체가 아닙니다.' }
  }
  const root = /** @type {Record<string, unknown>} */ (raw)
  const version = root.tcInvExportVersion
  const payload = root.payload != null ? root.payload : root

  if (version != null && Number(version) !== APP_DATA_EXPORT_VERSION) {
    return { error: `지원하지 않는 백업 버전입니다: ${String(version)}` }
  }
  if (!payload || typeof payload !== 'object') {
    return { error: 'payload 블록이 없습니다.' }
  }
  const p = /** @type {Record<string, unknown>} */ (payload)

  const patch = {}

  if (Array.isArray(p[storageKeys.master])) {
    patch.masterItems = p[storageKeys.master]
  }
  if (Array.isArray(p[storageKeys.plans])) {
    patch.deliveryPlans = migrateDeliveryPlansToSimple(p[storageKeys.plans])
  }
  if (Array.isArray(p[storageKeys.transit])) {
    patch.inTransit = migrateInTransitRows(p[storageKeys.transit])
  }
  if (p[storageKeys.ops] && typeof p[storageKeys.ops] === 'object' && !Array.isArray(p[storageKeys.ops])) {
    const o = /** @type {Record<string, unknown>} */ (p[storageKeys.ops])
    const base = { ...defaultOpsMeta, ...o }
    if (!base.asOfDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(base.asOfDate))) {
      base.asOfDate = getKoreaCalendarDate()
    }
    patch.opsMeta = base
  }
  if (Array.isArray(p[storageKeys.weekly])) {
    patch.weeklyPlans = p[storageKeys.weekly]
  }
  if (typeof p[storageKeys.starting] === 'number' && !Number.isNaN(p[storageKeys.starting])) {
    patch.startingInventory = p[storageKeys.starting]
  }
  if (p[storageKeys.simSource] != null) {
    patch.dataSimSource = p[storageKeys.simSource]
  }
  if (p[storageKeys.unitCostsKrw] && typeof p[storageKeys.unitCostsKrw] === 'object' && !Array.isArray(p[storageKeys.unitCostsKrw])) {
    patch.unitCostKrwBySku = p[storageKeys.unitCostsKrw]
  }
  if (Array.isArray(p[storageKeys.arrivalLedger])) {
    patch.arrivalLedger = p[storageKeys.arrivalLedger]
  }
  if (Array.isArray(p[storageKeys.receiptCancelLedger])) {
    patch.receiptCancelLedger = p[storageKeys.receiptCancelLedger]
  }
  if (Array.isArray(p[AUTH_STORAGE_KEYS.users])) {
    patch.users = p[AUTH_STORAGE_KEYS.users]
  }

  const hasAny =
    patch.masterItems != null ||
    patch.deliveryPlans != null ||
    patch.inTransit != null ||
    patch.opsMeta != null ||
    patch.weeklyPlans != null ||
    patch.startingInventory != null ||
    patch.dataSimSource != null ||
    patch.unitCostKrwBySku != null ||
    patch.arrivalLedger != null ||
    patch.receiptCancelLedger != null ||
    patch.users != null

  if (!hasAny) {
    return { error: '알 수 있는 데이터 키가 없습니다. tc-inv-* 키를 확인하세요.' }
  }

  return { patch }
}

/**
 * 서버/파일 가져오기 직후 React state와 동일한 내용을 localStorage에 즉시 반영합니다.
 * (useEffect 저장보다 먼저 디스크에 맞춰 PC·모바일 혼선을 줄입니다.)
 * @param {Record<string, unknown>} patch parseAppDataImport의 patch
 */
export function persistInventoryPatchToLocalStorage(patch) {
  if (!patch || typeof patch !== 'object') return
  try {
    if (patch.masterItems != null) saveJson(storageKeys.master, patch.masterItems)
    if (patch.deliveryPlans != null) saveJson(storageKeys.plans, patch.deliveryPlans)
    if (patch.inTransit != null) saveJson(storageKeys.transit, patch.inTransit)
    if (patch.opsMeta != null) saveJson(storageKeys.ops, patch.opsMeta)
    if (patch.weeklyPlans != null) saveJson(storageKeys.weekly, patch.weeklyPlans)
    if (patch.startingInventory != null) saveJson(storageKeys.starting, patch.startingInventory)
    if (patch.dataSimSource != null) saveJson(storageKeys.simSource, patch.dataSimSource)
    if (patch.unitCostKrwBySku != null) saveJson(storageKeys.unitCostsKrw, patch.unitCostKrwBySku)
    if (patch.arrivalLedger != null) saveJson(storageKeys.arrivalLedger, patch.arrivalLedger)
    if (patch.receiptCancelLedger != null) {
      saveJson(storageKeys.receiptCancelLedger, patch.receiptCancelLedger)
    }
    if (patch.users != null && Array.isArray(patch.users)) {
      saveUsersToStorage(patch.users)
    }
  } catch (e) {
    console.warn('[tc-inv sync] persistInventoryPatchToLocalStorage failed', e)
  }
}
