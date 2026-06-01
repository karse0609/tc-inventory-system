import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { operationsMeta as defaultOpsMeta } from './data/logisticsSampleData'
import {
  buildSeedDeliveryPlans,
  buildSeedInTransit,
  buildSeedMasterItems,
} from './data/seedMasterData'
import {
  INITIAL_STARTING_INVENTORY,
  weeklyPlans as sampleWeeklyPlans,
} from './data/sampleInventoryData'
import { markArrivalLedgerEntriesCancelled } from './utils/arrivalLedger'
import { normalizeModel } from './utils/modelName'
import { loadJson, saveJson, storageKeys } from './utils/appPersistence'
import { TRANSIT_ROW_STATUS, transitRowIdKey, isTransitRowReceived } from './utils/inTransitStatus'
import { newId } from './utils/newId'
import { getKoreaCalendarDate } from './utils/timeZones'
import { migrateDeliveryPlansToSimple } from './utils/deliveryPlanMigrate'
import { parsePlansStorageValue, toPlansStorageValue } from './utils/deliveryPlanModel'
import { migrateInTransitRows } from './utils/inTransitMigrate'
import {
  authenticate,
  clearAllAuthStorage,
  clearSession,
  ensureUsersInStorage,
  getSessionUserId,
  resolveSessionUser,
  saveUsersToStorage,
  setSessionUserId as writeBrowserSessionUserId,
} from './utils/auth'
import { VIEW_IDS, canAccessView, isAdminUser, isPartnerTestViewer } from './utils/permissions'
import {
  MOBILE_WAREHOUSE_NAV_VIEW_IDS,
  prefersMobileSimpleLayout,
  useMobileSimpleLayout,
} from './utils/mobileLayout'
import { VIEW_LABELS, L, formatKoEnInline } from './i18n/labels'
import { APP_DATA_EXPORT_VERSION, buildAppDataSnapshot, parseAppDataImport, persistInventoryPatchToLocalStorage } from './utils/appDataBackup'
import {
  buildInventoryRemoteUrl,
  inventoryRemoteRequest,
  inventoryRemoteSyncEnabled,
  readRemoteMeta,
  writeRemoteMeta,
} from './utils/inventoryRemoteSync'
import { logRemoteSync, REMOTE_SYNC_LOG_PREFIX } from './utils/remoteSyncDebug'
import BilingualLabel from './components/BilingualLabel'
import LoginPage from './components/auth/LoginPage.jsx'
import PwaInstallHint from './components/PwaInstallHint.jsx'
import Dashboard from './components/Dashboard.jsx'
import MasterDataPage from './components/pages/MasterDataPage.jsx'
import DeliveryPlanPage from './components/pages/DeliveryPlanPage.jsx'
import InTransitPage from './components/pages/InTransitPage.jsx'
import InventoryProjectionPage from './components/pages/InventoryProjectionPage.jsx'
import SettingsPage from './components/pages/SettingsPage.jsx'
import MobileAppShell from './components/mobile/MobileAppShell.jsx'
import MobileDashboardHome from './components/mobile/MobileDashboardHome.jsx'
import MobileTransitCards from './components/mobile/MobileTransitCards.jsx'
import MobileWarehouseCards from './components/mobile/MobileWarehouseCards.jsx'
import { getInTransitPcActiveViewRows } from './utils/inTransitPcView'
import './App.css'
import './components/pages/pages.css'

function firstAllowedView(authUser) {
  if (!authUser) return 'dashboard'
  return VIEW_IDS.find((id) => canAccessView(authUser, id)) ?? 'dashboard'
}

/** 좁은 화면(휴대폰·PWA): 요약 홈(대시보드)을 기본으로 */
function defaultHomeView(authUser) {
  if (!authUser) return 'dashboard'
  if (prefersMobileSimpleLayout()) {
    return canAccessView(authUser, 'dashboard') ? 'dashboard' : firstAllowedView(authUser)
  }
  return firstAllowedView(authUser)
}

function App() {
  const isMobileWarehouseNav = useMobileSimpleLayout()
  const isMobileWarehouseNavRef = useRef(isMobileWarehouseNav)
  isMobileWarehouseNavRef.current = isMobileWarehouseNav

  const [users, setUsers] = useState(() => ensureUsersInStorage())
  const [loggedInUserId, setLoggedInUserId] = useState(() => getSessionUserId())
  const [view, setView] = useState('dashboard')
  /** ≤700px 전용 하단 4탭 (PC 네비와 별개) */
  const [mobileSection, setMobileSection] = useState('dashboard')

  const authUser = useMemo(() => {
    if (!loggedInUserId) return null
    return resolveSessionUser(loggedInUserId, users)
  }, [loggedInUserId, users])

  const [masterItems, setMasterItems] = useState(() => {
    const loaded = loadJson(storageKeys.master)
    const rows = Array.isArray(loaded) && loaded.length ? loaded : buildSeedMasterItems()
    return rows.map((m) => ({ ...m, modelName: normalizeModel(m.modelName) || m.modelName }))
  })
  const [planStore, setPlanStore] = useState(() => {
    const raw = loadJson(storageKeys.plans)
    const { cells, weekConfirmations } = parsePlansStorageValue(raw)
    const mapPlanModels = (list) =>
      migrateDeliveryPlansToSimple(list).map((p) => ({
        ...p,
        modelName: normalizeModel(p.modelName) || p.modelName,
      }))
    if (cells.length) {
      return {
        cells: mapPlanModels(cells),
        weekConfirmations: weekConfirmations && typeof weekConfirmations === 'object' ? weekConfirmations : {},
      }
    }
    return {
      cells: mapPlanModels(buildSeedDeliveryPlans()),
      weekConfirmations: {},
    }
  })
  const deliveryPlans = planStore.cells
  const weekConfirmations = planStore.weekConfirmations
  const setDeliveryPlans = useCallback((next) => {
    setPlanStore((s) => ({
      ...s,
      cells: typeof next === 'function' ? next(s.cells) : next,
    }))
  }, [])
  const setWeekConfirmations = useCallback((next) => {
    setPlanStore((s) => ({
      ...s,
      weekConfirmations: typeof next === 'function' ? next(s.weekConfirmations) : { ...next },
    }))
  }, [])
  const [inTransit, setInTransit] = useState(() => {
    const loaded = loadJson(storageKeys.transit)
    if (Array.isArray(loaded) && loaded.length) {
      return migrateInTransitRows(loaded).map((r) => ({
        ...r,
        modelName: normalizeModel(r.modelName) || r.modelName,
      }))
    }
    return buildSeedInTransit()
  })
  const [opsMeta, setOpsMeta] = useState(() => {
    const loaded = loadJson(storageKeys.ops)
    const base =
      loaded && typeof loaded === 'object' ? { ...defaultOpsMeta, ...loaded } : { ...defaultOpsMeta }
    if (!base.asOfDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(base.asOfDate))) {
      base.asOfDate = getKoreaCalendarDate()
    }
    return base
  })
  const [weeklyPlans, setWeeklyPlans] = useState(() => {
    const loaded = loadJson(storageKeys.weekly)
    return Array.isArray(loaded) && loaded.length ? loaded : sampleWeeklyPlans
  })
  const [startingInventory, setStartingInventory] = useState(() => {
    const v = loadJson(storageKeys.starting)
    return typeof v === 'number' && !Number.isNaN(v) ? v : INITIAL_STARTING_INVENTORY
  })
  const [dataSimSource, setDataSimSource] = useState(
    () => loadJson(storageKeys.simSource) ?? 'sample',
  )
  const [unitCostKrwBySku, setUnitCostKrwBySku] = useState(() => {
    const loaded = loadJson(storageKeys.unitCostsKrw)
    return loaded && typeof loaded === 'object' && !Array.isArray(loaded) ? loaded : {}
  })
  const [arrivalLedger, setArrivalLedger] = useState(() => {
    const raw = loadJson(storageKeys.arrivalLedger)
    return Array.isArray(raw) ? raw : []
  })
  const [receiptCancelLedger, setReceiptCancelLedger] = useState(() => {
    const raw = loadJson(storageKeys.receiptCancelLedger)
    return Array.isArray(raw) ? raw : []
  })

  const appendArrivalLedger = useCallback((entries) => {
    if (isPartnerTestViewer(authUser)) return
    if (!Array.isArray(entries) || !entries.length) return
    setArrivalLedger((prev) => [...prev, ...entries])
  }, [authUser])

  const applyReceiptCancellation = useCallback(
    (rows, cancelledByLabel) => {
      if (isPartnerTestViewer(authUser)) return
      if (!Array.isArray(rows) || !rows.length) return

      console.log('4. applyReceiptCancellation 시작')
      console.log('  전달받은 rows', rows)
      console.log('  row ids', rows.map((r) => String(r.id)))

      const atIso = new Date().toISOString()
      const by = String(cancelledByLabel || '').trim() || '—'
      const cancelIds = new Set(rows.map((r) => String(r.id)))

      console.log('5. setInTransit 직전 복원 대상 rows', rows)

      setInTransit((prev) => {
        const next = prev.map((row) => {
          if (!cancelIds.has(String(row.id))) return row
          return {
            ...row,
            transitStatus: TRANSIT_ROW_STATUS.IN_TRANSIT,
            arrived: false,
            receiptDate: null,
            receivedBy: '',
            receivedAtIso: null,
            cancelledAtIso: atIso,
            cancelledBy: by,
          }
        })
        const remainingHistory = next.filter((r) => isTransitRowReceived(r))
        console.log('6. setInTransit 이후 남은 historyRows(입고완료)')
        console.log('  length', remainingHistory.length)
        console.log('  ids', remainingHistory.map((r) => r.id))
        return next
      })

      setMasterItems((master) => {
        const next = master.map((m) => ({ ...m }))
        for (const r of rows) {
          const qty = Math.max(0, Number(r.qty) || 0)
          if (qty <= 0) continue
          const model = String(r.modelName ?? '').trim()
          const part = String(r.partNo ?? '').trim()
          const ix = next.findIndex(
            (x) =>
              String(x.partNo ?? '').trim() === part && String(x.modelName ?? '').trim() === model,
          )
          if (ix >= 0) {
            next[ix] = {
              ...next[ix],
              currentStock: Math.max(0, (Number(next[ix].currentStock) || 0) - qty),
            }
          }
        }
        return next
      })

      setArrivalLedger((prev) =>
        markArrivalLedgerEntriesCancelled(prev, rows, { atIso, cancelledBy: by }),
      )

      setReceiptCancelLedger((prev) => [
        ...prev,
        ...rows.map((r) => ({
          id: newId('rcl'),
          atIso,
          cancelledBy: by,
          transitRowId: transitRowIdKey(r.id),
          modelName: r.modelName,
          partNo: r.partNo,
          qty: Math.max(0, Number(r.qty) || 0),
          previousReceiptDate: String(r.receiptDate ?? '').trim(),
          previousReceivedAtIso: String(r.receivedAtIso ?? '').trim(),
          previousReceivedBy: String(r.receivedBy ?? '').trim(),
        })),
      ])
    },
    [authUser],
  )

  useEffect(() => {
    saveUsersToStorage(users)
  }, [users])

  useEffect(() => {
    if (loggedInUserId && !authUser) {
      /* eslint-disable react-hooks/set-state-in-effect -- session user removed or deactivated */
      clearSession()
      setLoggedInUserId(null)
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [loggedInUserId, authUser])

  const persistMasterItems = useCallback((rows) => {
    if (isPartnerTestViewer(authUser)) return
    setMasterItems(rows)
  }, [authUser])

  const persistPlanStore = useCallback(({ cells, weekConfirmations }) => {
    if (isPartnerTestViewer(authUser)) return
    setPlanStore({ cells, weekConfirmations })
  }, [authUser])

  const persistInTransit = useCallback((rows) => {
    if (isPartnerTestViewer(authUser)) return
    setInTransit(rows)
  }, [authUser])

  /** 창고·출고·운송중: 모바일 조회 전용 레이아웃에서는 localStorage에 재고 스냅샷을 쓰지 않음(PC·원격이 단일 정본) */
  useEffect(() => {
    if (isMobileWarehouseNav) return
    saveJson(storageKeys.master, masterItems)
  }, [masterItems, isMobileWarehouseNav])
  useEffect(() => {
    if (isMobileWarehouseNav) return
    saveJson(storageKeys.plans, toPlansStorageValue(planStore.cells, planStore.weekConfirmations))
  }, [planStore, isMobileWarehouseNav])
  useEffect(() => {
    if (isMobileWarehouseNav) return
    saveJson(storageKeys.transit, inTransit)
  }, [inTransit, isMobileWarehouseNav])
  useEffect(() => {
    if (isMobileWarehouseNav) return
    saveJson(storageKeys.ops, opsMeta)
  }, [opsMeta, isMobileWarehouseNav])
  useEffect(() => {
    if (isMobileWarehouseNav) return
    saveJson(storageKeys.weekly, weeklyPlans)
  }, [weeklyPlans, isMobileWarehouseNav])
  useEffect(() => {
    if (isMobileWarehouseNav) return
    saveJson(storageKeys.starting, startingInventory)
  }, [startingInventory, isMobileWarehouseNav])
  useEffect(() => {
    if (isMobileWarehouseNav) return
    saveJson(storageKeys.simSource, dataSimSource)
  }, [dataSimSource, isMobileWarehouseNav])
  useEffect(() => {
    if (isMobileWarehouseNav) return
    saveJson(storageKeys.unitCostsKrw, unitCostKrwBySku)
  }, [unitCostKrwBySku, isMobileWarehouseNav])
  useEffect(() => {
    if (isMobileWarehouseNav) return
    saveJson(storageKeys.arrivalLedger, arrivalLedger)
  }, [arrivalLedger, isMobileWarehouseNav])
  useEffect(() => {
    if (isMobileWarehouseNav) return
    saveJson(storageKeys.receiptCancelLedger, receiptCancelLedger)
  }, [receiptCancelLedger, isMobileWarehouseNav])

  const resetAllData = useCallback(() => {
    if (isPartnerTestViewer(authUser)) return
    Object.values(storageKeys).forEach((k) => localStorage.removeItem(k))
    setMasterItems(buildSeedMasterItems())
    setPlanStore({
      cells: migrateDeliveryPlansToSimple(buildSeedDeliveryPlans()),
      weekConfirmations: {},
    })
    setInTransit(buildSeedInTransit())
    setOpsMeta({ ...defaultOpsMeta, asOfDate: getKoreaCalendarDate() })
    setWeeklyPlans(sampleWeeklyPlans)
    setStartingInventory(INITIAL_STARTING_INVENTORY)
    setDataSimSource('sample')
    setUnitCostKrwBySku({})
    setArrivalLedger([])
    setReceiptCancelLedger([])
  }, [authUser])

  const downloadAppDataBackup = useCallback(() => {
    const payload = buildAppDataSnapshot({
      masterItems,
      deliveryPlans,
      weekConfirmations,
      inTransit,
      opsMeta,
      weeklyPlans,
      startingInventory,
      dataSimSource,
      unitCostKrwBySku,
      arrivalLedger,
      receiptCancelLedger,
      users,
    })
    const envelope = {
      tcInvExportVersion: APP_DATA_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      app: 'tc-inventory-system',
      payload,
    }
    const text = JSON.stringify(envelope, null, 2)
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tc-inv-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [
    masterItems,
    deliveryPlans,
    weekConfirmations,
    inTransit,
    opsMeta,
    weeklyPlans,
    startingInventory,
    dataSimSource,
    unitCostKrwBySku,
    arrivalLedger,
    receiptCancelLedger,
    users,
  ])

  const importAppDataBackup = useCallback((parsed, syncSource = 'manual', importOpts = {}) => {
    const persistLocal = importOpts.persistLocal !== false
    const topKeys = parsed && typeof parsed === 'object' ? Object.keys(parsed) : []
    console.log('[tc-inv sync] importAppDataBackup:begin', { syncSource, topKeys })
    const result = parseAppDataImport(parsed)
    if ('error' in result && result.error) {
      console.warn('[tc-inv sync] importAppDataBackup:parse-error', { syncSource, error: result.error })
      window.alert(result.error)
      return
    }
    const { patch } = result
    const appliedKeys = Object.keys(patch).filter((k) => patch[k] != null)
    const mergeSummary = {}
    if (Array.isArray(patch.masterItems)) mergeSummary.masterItems = patch.masterItems.length
    if (Array.isArray(patch.deliveryPlans)) mergeSummary.deliveryPlans = patch.deliveryPlans.length
    if (patch.weekConfirmations != null && typeof patch.weekConfirmations === 'object') {
      mergeSummary.weekConfirmations = Object.keys(patch.weekConfirmations).filter(
        (k) => patch.weekConfirmations[k] === true,
      ).length
    }
    if (Array.isArray(patch.inTransit)) mergeSummary.inTransit = patch.inTransit.length
    if (Array.isArray(patch.weeklyPlans)) mergeSummary.weeklyPlans = patch.weeklyPlans.length
    if (Array.isArray(patch.arrivalLedger)) mergeSummary.arrivalLedger = patch.arrivalLedger.length
    if (Array.isArray(patch.receiptCancelLedger)) mergeSummary.receiptCancelLedger = patch.receiptCancelLedger.length
    if (Array.isArray(patch.users)) mergeSummary.users = patch.users.length
    if (patch.opsMeta) mergeSummary.opsMeta = true
    logRemoteSync('merge:from-server', { syncSource, mergeSummary, appliedKeys })
    if (patch.masterItems != null) setMasterItems(patch.masterItems)
    if (patch.deliveryPlans != null || patch.weekConfirmations != null) {
      setPlanStore((s) => ({
        cells: patch.deliveryPlans != null ? patch.deliveryPlans : s.cells,
        weekConfirmations:
          patch.weekConfirmations != null ? patch.weekConfirmations : s.weekConfirmations,
      }))
    }
    if (patch.inTransit != null) setInTransit(patch.inTransit)
    if (patch.opsMeta != null) setOpsMeta(patch.opsMeta)
    if (patch.weeklyPlans != null) setWeeklyPlans(patch.weeklyPlans)
    if (patch.startingInventory != null) setStartingInventory(patch.startingInventory)
    if (patch.dataSimSource != null) setDataSimSource(String(patch.dataSimSource))
    if (patch.unitCostKrwBySku != null) setUnitCostKrwBySku(patch.unitCostKrwBySku)
    if (patch.arrivalLedger != null) setArrivalLedger(patch.arrivalLedger)
    if (patch.receiptCancelLedger != null) setReceiptCancelLedger(patch.receiptCancelLedger)
    if (patch.users != null) {
      setUsers(patch.users)
    }
    if (persistLocal) {
      persistInventoryPatchToLocalStorage(patch)
      logRemoteSync('importAppDataBackup:persisted-local', { syncSource, appliedKeys })
    } else {
      logRemoteSync('importAppDataBackup:skip-local-persist', { syncSource, appliedKeys })
    }
    console.log('[tc-inv sync] importAppDataBackup:done', { syncSource, appliedKeys })
  }, [])

  const applyingRemoteRef = useRef(false)
  const remoteBootstrapGenRef = useRef(0)
  const [remoteHydrated, setRemoteHydrated] = useState(() => !inventoryRemoteSyncEnabled())
  const setRemoteHydratedLogged = useCallback((next, reason) => {
    console.log(REMOTE_SYNC_LOG_PREFIX, 'setRemoteHydrated', {
      next,
      reason,
      at: new Date().toISOString(),
      perfMs: typeof performance !== 'undefined' ? Math.round(performance.now()) : undefined,
    })
    setRemoteHydrated(next)
  }, [])
  const [remoteUi, setRemoteUi] = useState({
    busyPull: false,
    busyPush: false,
    error: '',
    lastOk: '',
  })

  useEffect(() => {
    console.log(REMOTE_SYNC_LOG_PREFIX, 'remoteHydrated:commit', {
      remoteHydrated,
      at: new Date().toISOString(),
    })
  }, [remoteHydrated])

  useEffect(() => {
    if (!authUser) return
    logRemoteSync('runtime:remote-sync', {
      enabled: inventoryRemoteSyncEnabled(),
      apiUrl: inventoryRemoteSyncEnabled() ? buildInventoryRemoteUrl() : null,
      verboseFetchBody: import.meta.env.VITE_DEBUG_REMOTE_SYNC === 'true',
    })
  }, [authUser])

  const pullRemoteInventory = useCallback(async () => {
    if (!inventoryRemoteSyncEnabled() || !authUser) return { ok: false, error: 'remote_disabled' }
    const uid = String(authUser.userId || authUser.id || '').trim()
    console.log('[tc-inv sync] pullRemoteInventory:start', {
      userId: uid,
      at: new Date().toISOString(),
    })
    setRemoteUi((u) => ({ ...u, busyPull: true }))
    const r = await inventoryRemoteRequest('GET')
    setRemoteUi((u) => ({ ...u, busyPull: false }))
    if (!authUser) return { ok: false, error: 'not_authenticated' }
    console.log('[tc-inv sync] pullRemoteInventory:http', {
      ok: r.ok,
      status: r.status,
      error: r.ok ? undefined : r.error,
    })
    const data = r.ok ? r.data : null
    const usable =
      r.ok && data && typeof data === 'object' && data.payload && typeof data.payload === 'object'
    if (!usable) {
      if (!r.ok) {
        console.warn('[tc-inv sync] pullRemoteInventory: keep-local (HTTP/network)', {
          status: r.status,
          error: r.error,
        })
      } else {
        console.warn('[tc-inv sync] pullRemoteInventory: keep-local (no payload)', {
          keys: data && typeof data === 'object' ? Object.keys(data) : [],
        })
      }
      setRemoteUi((u) => ({ ...u, error: '' }))
      return { ok: true, empty: true }
    }
    console.log('[tc-inv sync] pullRemoteInventory → importAppDataBackup', {
      updatedAt: data.updatedAt,
      hasPayload: true,
    })
    applyingRemoteRef.current = true
    const persistLocal = true
    importAppDataBackup(data, 'remote-pull', { persistLocal })
    if (data.updatedAt) writeRemoteMeta({ lastRemoteUpdatedAt: data.updatedAt })
    writeRemoteMeta({ lastPullOkAt: new Date().toISOString() })
    requestAnimationFrame(() => {
      applyingRemoteRef.current = false
    })
    setRemoteUi((u) => ({ ...u, error: '', lastOk: new Date().toISOString() }))
    console.log('[tc-inv sync] pullRemoteInventory:complete (state updated from server)')
    return { ok: true }
  }, [authUser, importAppDataBackup])

  const mobileTransitRows = useMemo(() => getInTransitPcActiveViewRows(inTransit), [inTransit])

  const handleMobileSection = useCallback(
    (id) => {
      setMobileSection(id)
      const nextView = id === 'warehouse' ? 'master' : id === 'dashboard' ? 'dashboard' : 'transit'
      if (!authUser) return
      if (canAccessView(authUser, nextView)) {
        setView(nextView)
        window.history.replaceState(null, '', `#/${nextView}`)
      }
    },
    [authUser],
  )

  const handleMobileReload = useCallback(() => {
    window.location.reload()
  }, [])

  const snapshotJson = useMemo(
    () =>
      JSON.stringify(
        buildAppDataSnapshot({
          masterItems,
          deliveryPlans,
          weekConfirmations,
          inTransit,
          opsMeta,
          weeklyPlans,
          startingInventory,
          dataSimSource,
          unitCostKrwBySku,
          arrivalLedger,
          receiptCancelLedger,
          users,
        }),
      ),
    [
      masterItems,
      deliveryPlans,
      weekConfirmations,
      inTransit,
      opsMeta,
      weeklyPlans,
      startingInventory,
      dataSimSource,
      unitCostKrwBySku,
      arrivalLedger,
      receiptCancelLedger,
      users,
    ],
  )

  const pushRemoteInventoryNow = useCallback(async (opts = {}) => {
    const silent = opts.silent === true
    if (!inventoryRemoteSyncEnabled() || !authUser) return { ok: false }
    if (isPartnerTestViewer(authUser)) return { ok: false }
    if (!silent) setRemoteUi((u) => ({ ...u, busyPush: true }))
    let payload
    try {
      payload = JSON.parse(snapshotJson)
    } catch {
      if (!silent) setRemoteUi((u) => ({ ...u, busyPush: false }))
      return { ok: false }
    }
    const body = { tcInvExportVersion: APP_DATA_EXPORT_VERSION, payload }
    try {
      const r = await inventoryRemoteRequest('PUT', body)
      logRemoteSync('push:http', {
        ok: r.ok,
        status: r.status,
        updatedAt: r.data?.updatedAt,
        error: r.ok ? undefined : r.error,
      })
      if (r.ok && r.data?.updatedAt) {
        writeRemoteMeta({ lastRemoteUpdatedAt: r.data.updatedAt, lastPushOkAt: new Date().toISOString() })
        setRemoteUi((u) => ({ ...u, error: '', lastOk: new Date().toISOString() }))
        return { ok: true }
      }
      console.warn(REMOTE_SYNC_LOG_PREFIX, 'pushRemoteInventory:skipped', {
        ok: r.ok,
        status: r.status,
        error: r.error,
      })
      return { ok: false }
    } finally {
      if (!silent) setRemoteUi((u) => ({ ...u, busyPush: false }))
    }
  }, [authUser, snapshotJson])

  /** 입고/취소 등 로컬 상태 반영 직후 원격에 밀어 넣고 다시 당겨 옴 (모바일·PC 공통) */
  const scheduleRemoteSyncAfterMutation = useCallback(() => {
    if (!inventoryRemoteSyncEnabled() || !authUser) return
    if (isPartnerTestViewer(authUser)) return
    window.setTimeout(async () => {
      await pushRemoteInventoryNow({ silent: false })
      await pullRemoteInventory()
    }, 120)
  }, [authUser, pushRemoteInventoryNow, pullRemoteInventory])

  useEffect(() => {
    if (!authUser) {
      queueMicrotask(() =>
        setRemoteHydratedLogged(!inventoryRemoteSyncEnabled(), 'effect:no-auth'),
      )
      return undefined
    }
    if (!inventoryRemoteSyncEnabled()) {
      queueMicrotask(() => setRemoteHydratedLogged(true, 'effect:remote-sync-off'))
      return undefined
    }
    const gen = ++remoteBootstrapGenRef.current
    queueMicrotask(() => {
      setRemoteHydratedLogged(false, 'effect:remote-bootstrap:pre-pull')
      setRemoteUi((u) => ({ ...u, error: '' }))
    })
    void (async () => {
      try {
        logRemoteSync('bootstrap:pull-begin', { gen, userId: String(authUser.userId || authUser.id || '') })
        const pullResult = await pullRemoteInventory()
        logRemoteSync('bootstrap:pull-finished', {
          gen,
          currentGen: remoteBootstrapGenRef.current,
          pullOk: pullResult?.ok,
          empty: pullResult?.empty,
          skippedStaleGen: remoteBootstrapGenRef.current !== gen,
        })
      } catch (e) {
        console.error(REMOTE_SYNC_LOG_PREFIX, 'bootstrap:pull-unhandled', e)
      }
      if (remoteBootstrapGenRef.current !== gen) return
      queueMicrotask(() =>
        setRemoteHydratedLogged(true, 'effect:remote-bootstrap:after-pull'),
      )
    })()
    return () => {
      remoteBootstrapGenRef.current += 1
    }
  }, [authUser, pullRemoteInventory, setRemoteHydratedLogged])

  useEffect(() => {
    if (!authUser || !inventoryRemoteSyncEnabled()) return undefined
    if (isPartnerTestViewer(authUser)) return undefined
    if (!remoteHydrated) return undefined
    if (isMobileWarehouseNav) return undefined
    if (applyingRemoteRef.current) return undefined
    const t = window.setTimeout(() => {
      if (applyingRemoteRef.current) return
      void pushRemoteInventoryNow({ silent: true })
    }, 400)
    return () => window.clearTimeout(t)
  }, [snapshotJson, authUser, remoteHydrated, pushRemoteInventoryNow, isMobileWarehouseNav])

  useEffect(() => {
    if (!authUser || !inventoryRemoteSyncEnabled()) return undefined
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void pullRemoteInventory()
    }, 45000)
    return () => window.clearInterval(id)
  }, [authUser, pullRemoteInventory])

  useEffect(() => {
    if (!authUser || !inventoryRemoteSyncEnabled()) return undefined
    const onVis = () => {
      if (document.visibilityState === 'visible') void pullRemoteInventory()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [authUser, pullRemoteInventory])

  useEffect(() => {
    if (!authUser || !inventoryRemoteSyncEnabled()) return undefined
    const onFocus = () => {
      void pullRemoteInventory()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [authUser, pullRemoteInventory])

  /** 뷰 전환 시 서버 pull (PC·모바일 공통) */
  useEffect(() => {
    if (!authUser || !inventoryRemoteSyncEnabled() || !remoteHydrated) return undefined
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- pullRemoteInventory updates UI via async GET + setState */
    void pullRemoteInventory()
  }, [authUser, remoteHydrated, pullRemoteInventory, view])

  const visibleNav = useMemo(
    () =>
      authUser
        ? VIEW_IDS.filter((id) => {
            if (!canAccessView(authUser, id)) return false
            if (isMobileWarehouseNav && !MOBILE_WAREHOUSE_NAV_VIEW_IDS.includes(id)) return false
            return true
          }).map((id) => ({
            id,
            label: VIEW_LABELS[id],
          }))
        : [],
    [authUser, isMobileWarehouseNav],
  )

  const DRAFT_GUARD_VIEWS = useMemo(() => new Set(['master', 'delivery', 'transit']), [])
  const unsavedCheckersRef = useRef({})

  const registerUnsavedGuard = useCallback((screenId, checker) => {
    if (!screenId) return
    if (checker == null) delete unsavedCheckersRef.current[screenId]
    else unsavedCheckersRef.current[screenId] = checker
  }, [])

  const confirmLeaveView = useCallback(
    (fromView, toView) => {
      if (isMobileWarehouseNav) return true
      if (!fromView || fromView === toView || !DRAFT_GUARD_VIEWS.has(fromView)) return true
      const checker = unsavedCheckersRef.current[fromView]
      if (typeof checker === 'function' && checker()) {
        return window.confirm(formatKoEnInline(L.unsavedNavigateConfirm))
      }
      return true
    },
    [DRAFT_GUARD_VIEWS, isMobileWarehouseNav],
  )

  const goView = useCallback(
    (next) => {
      if (!authUser || !canAccessView(authUser, next)) return
      if (isMobileWarehouseNav && !MOBILE_WAREHOUSE_NAV_VIEW_IDS.includes(next)) return
      if (!confirmLeaveView(view, next)) return
      setView(next)
      window.history.replaceState(null, '', `#/${next}`)
    },
    [authUser, isMobileWarehouseNav, view, confirmLeaveView],
  )

  useEffect(() => {
    if (!authUser) return
    /* eslint-disable react-hooks/set-state-in-effect -- align view with URL hash after login */
    const raw = window.location.hash.replace(/^#\/?/, '')
    const mobileBlocked =
      isMobileWarehouseNav &&
      raw &&
      VIEW_IDS.includes(raw) &&
      !MOBILE_WAREHOUSE_NAV_VIEW_IDS.includes(raw)
    if (raw && VIEW_IDS.includes(raw) && canAccessView(authUser, raw) && !mobileBlocked) {
      setView(raw)
    } else {
      const first = defaultHomeView(authUser)
      setView(first)
      window.history.replaceState(null, '', `#/${first}`)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [authUser, isMobileWarehouseNav])

  useEffect(() => {
    if (!authUser || !isMobileWarehouseNav) return
    const raw = window.location.hash.replace(/^#\/?/, '')
    if (raw === 'master') setMobileSection('warehouse')
    else if (raw === 'transit') setMobileSection('transit')
    else setMobileSection('dashboard')
  }, [authUser, isMobileWarehouseNav])

  useEffect(() => {
    if (!authUser) return
    const onHash = () => {
      const raw = window.location.hash.replace(/^#\/?/, '')
      if (
        !raw ||
        !VIEW_IDS.includes(raw) ||
        !canAccessView(authUser, raw) ||
        (isMobileWarehouseNav && !MOBILE_WAREHOUSE_NAV_VIEW_IDS.includes(raw))
      ) {
        const first = defaultHomeView(authUser)
        window.history.replaceState(null, '', `#/${first}`)
        if (!confirmLeaveView(view, first)) {
          window.history.replaceState(null, '', `#/${view}`)
          return
        }
        setView(first)
        return
      }
      if (!confirmLeaveView(view, raw)) {
        window.history.replaceState(null, '', `#/${view}`)
        return
      }
      setView(raw)
      if (isMobileWarehouseNav) {
        if (raw === 'master') setMobileSection('warehouse')
        else if (raw === 'transit') setMobileSection('transit')
        else setMobileSection('dashboard')
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [authUser, isMobileWarehouseNav, view, confirmLeaveView])

  useEffect(() => {
    if (!authUser) return
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!canAccessView(authUser, view)) {
      const first = defaultHomeView(authUser)
      setView(first)
      window.history.replaceState(null, '', `#/${first}`)
      return
    }
    if (isMobileWarehouseNav && !MOBILE_WAREHOUSE_NAV_VIEW_IDS.includes(view)) {
      const first = defaultHomeView(authUser)
      setView(first)
      window.history.replaceState(null, '', `#/${first}`)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [authUser, view, isMobileWarehouseNav])

  async function handleLogin(userId, password) {
    const u = await authenticate(userId, password, users)
    if (!u) return false
    if (inventoryRemoteSyncEnabled()) {
      console.log('[tc-inv sync] login:success → will pullRemoteInventory then importAppDataBackup', {
        userId: String(u.userId || u.id || '').trim(),
      })
    }
    writeBrowserSessionUserId(u.id)
    setLoggedInUserId(u.id)
    return true
  }

  function handleLogout() {
    clearSession()
    setLoggedInUserId(null)
    setView('dashboard')
    setMobileSection('dashboard')
    window.history.replaceState(null, '', '#/')
  }

  function handleForceAuthReset() {
    clearAllAuthStorage()
    setUsers(ensureUsersInStorage())
    setLoggedInUserId(null)
    setView('dashboard')
    setMobileSection('dashboard')
    window.history.replaceState(null, '', '#/')
  }

  if (!authUser) {
    return (
      <div className="app">
        <PwaInstallHint />
        <LoginPage onLogin={handleLogin} />
      </div>
    )
  }

  /** 모바일·test 계정도 첫 GET 전에는 로컬 시드가 보이지 않도록 동일하게 대기 */
  const blockingRemoteBootstrap = inventoryRemoteSyncEnabled() && authUser && !remoteHydrated

  if (blockingRemoteBootstrap) {
    return (
      <div className="app app--remote-syncing">
        <PwaInstallHint />
        <div className="remote-sync-splash" role="status" aria-live="polite">
          <p className="remote-sync-splash__title">서버에서 최신 재고를 불러오는 중…</p>
          <p className="remote-sync-splash__sub">Loading latest inventory from server…</p>
          {remoteUi.busyPull ? (
            <p className="remote-sync-splash__hint">잠시만 기다려 주세요. (Please wait.)</p>
          ) : null}
          <button
            type="button"
            className="btn btn--ghost remote-sync-splash__retry"
            onClick={() => void pullRemoteInventory()}
          >
            다시 불러오기 / Retry pull
          </button>
        </div>
      </div>
    )
  }

  const mobileUserLabel = authUser
    ? String(authUser.name || authUser.userId || authUser.id || '').trim()
    : ''

  return (
    <div className={`app${isMobileWarehouseNav ? ' app--mobile-shell' : ''}`}>
      {!isMobileWarehouseNav && isAdminUser(authUser) && !inventoryRemoteSyncEnabled() ? (
        <div className="remote-sync-banner remote-sync-banner--off" role="status">
          <span className="remote-sync-banner__text">
            <BilingualLabel label={L.remoteSyncBannerOff} as="span" />
          </span>
        </div>
      ) : null}
      {!isMobileWarehouseNav && isAdminUser(authUser) && inventoryRemoteSyncEnabled() && remoteHydrated ? (
        <div className="remote-sync-banner remote-sync-banner--on" role="status">
          <span className="remote-sync-banner__text">
            <BilingualLabel label={L.remoteSyncBannerOn} as="span" />
          </span>
        </div>
      ) : null}

      {isMobileWarehouseNav ? (
        <>
          <MobileAppShell
            mobileSection={mobileSection}
            onSection={handleMobileSection}
            onReload={handleMobileReload}
            onLogout={handleLogout}
            userLabel={mobileUserLabel}
          >
            {mobileSection === 'dashboard' ? (
              <MobileDashboardHome inTransit={inTransit} masterItems={masterItems} opsMeta={opsMeta} />
            ) : null}
            {mobileSection === 'transit' ? (
              <MobileTransitCards rows={mobileTransitRows} titleLabel={L.inTransitInventoryScreen} mode="transit" />
            ) : null}
            {mobileSection === 'receiving' ? (
              <MobileTransitCards rows={mobileTransitRows} titleLabel={L.mobileReceivingTabTitle} mode="receiving" />
            ) : null}
            {mobileSection === 'warehouse' ? <MobileWarehouseCards masterItems={masterItems} /> : null}
          </MobileAppShell>
          <PwaInstallHint />
        </>
      ) : (
        <>
          <nav className="app-nav" aria-label="Main">
            <span className="app-nav__brand" title="TC TECH 실시간 해외재고 관리">
              TC TECH
              <span className="app-nav__brand-sub">· 실시간 해외재고</span>
            </span>
            {visibleNav.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`app-nav__btn ${view === v.id ? 'app-nav__btn--active' : ''}`}
                onClick={() => goView(v.id)}
              >
                <BilingualLabel label={v.label} as="span" />
              </button>
            ))}
            <div className="app-nav__user">
              <span className="app-nav__user-meta" title={authUser.userId}>
                {authUser.name || authUser.userId}
                <span className="app-nav__role"> · {authUser.role}</span>
              </span>
              <button type="button" className="btn btn--ghost app-nav__logout" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </nav>

          <PwaInstallHint />

          {view === 'dashboard' && (
            <Dashboard
              masterItems={masterItems}
              deliveryPlans={deliveryPlans}
              weekConfirmations={weekConfirmations}
              inTransitContainers={inTransit}
              opsMeta={opsMeta}
              setOpsMeta={isPartnerTestViewer(authUser) ? undefined : setOpsMeta}
              unitCostKrwBySku={unitCostKrwBySku}
              arrivalLedger={arrivalLedger}
              readOnlyMobile={isPartnerTestViewer(authUser)}
              isAdminViewer={isAdminUser(authUser)}
            />
          )}
          {view === 'master' && (
            <MasterDataPage
              masterItems={masterItems}
              onPersistMasterItems={persistMasterItems}
              registerUnsavedGuard={registerUnsavedGuard}
              deliveryPlans={deliveryPlans}
              inTransit={inTransit}
              opsMeta={opsMeta}
              readOnly={isPartnerTestViewer(authUser)}
            />
          )}
          {view === 'delivery' && (
            <DeliveryPlanPage
              masterItems={masterItems}
              onPersistMasterItems={persistMasterItems}
              deliveryPlans={deliveryPlans}
              weekConfirmations={weekConfirmations}
              onPersistPlanStore={persistPlanStore}
              registerUnsavedGuard={registerUnsavedGuard}
              opsMeta={opsMeta}
              onRequestRemoteSync={scheduleRemoteSyncAfterMutation}
              inventoryReadOnly={isPartnerTestViewer(authUser)}
            />
          )}
          {view === 'transit' && (
            <InTransitPage
              inTransit={inTransit}
              onPersistInTransit={persistInTransit}
              registerUnsavedGuard={registerUnsavedGuard}
              setMasterItems={setMasterItems}
              masterItems={masterItems}
              appendArrivalLedger={appendArrivalLedger}
              onApplyReceiptCancellation={applyReceiptCancellation}
              currentUserLabel={
                authUser ? String(authUser.name || authUser.userId || authUser.id || '').trim() : ''
              }
              onRequestRemoteSync={scheduleRemoteSyncAfterMutation}
              readOnly={isPartnerTestViewer(authUser)}
            />
          )}
          {view === 'projection' && (
            <InventoryProjectionPage
              masterItems={masterItems}
              deliveryPlans={deliveryPlans}
              weekConfirmations={weekConfirmations}
              inTransit={inTransit}
              opsMeta={opsMeta}
            />
          )}
          {view === 'settings' && (
            <SettingsPage
              opsMeta={opsMeta}
              setOpsMeta={setOpsMeta}
              onResetAllData={resetAllData}
              onDownloadAppDataBackup={downloadAppDataBackup}
              onImportAppDataBackup={importAppDataBackup}
              isAdmin={isAdminUser(authUser)}
              users={users}
              setUsers={setUsers}
              currentUserId={authUser.id}
              onForceAuthReset={handleForceAuthReset}
              onNavigateView={goView}
              masterItems={masterItems}
              unitCostKrwBySku={unitCostKrwBySku}
              setUnitCostKrwBySku={setUnitCostKrwBySku}
              remoteSync={{
                enabled: inventoryRemoteSyncEnabled(),
                meta: readRemoteMeta(),
                busyPull: remoteUi.busyPull,
                busyPush: remoteUi.busyPush,
                error: remoteUi.error,
                lastOk: remoteUi.lastOk,
                onPull: pullRemoteInventory,
                onPush: () => pushRemoteInventoryNow({ silent: false }),
              }}
            />
          )}
        </>
      )}
    </div>
  )
}

export default App
