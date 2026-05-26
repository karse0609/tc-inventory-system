import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { loadJson, saveJson, storageKeys } from './utils/appPersistence'
import { getKoreaCalendarDate } from './utils/timeZones'
import { migrateDeliveryPlansToSimple } from './utils/deliveryPlanMigrate'
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
import { VIEW_IDS, canAccessView, isAdminUser } from './utils/permissions'
import { VIEW_LABELS, formatKoEn } from './i18n/labels'
import LoginPage from './components/auth/LoginPage.jsx'
import Dashboard from './components/Dashboard.jsx'
import MasterDataPage from './components/pages/MasterDataPage.jsx'
import DeliveryPlanPage from './components/pages/DeliveryPlanPage.jsx'
import InTransitPage from './components/pages/InTransitPage.jsx'
import InventoryProjectionPage from './components/pages/InventoryProjectionPage.jsx'
import SettingsPage from './components/pages/SettingsPage.jsx'
import './App.css'
import './components/pages/pages.css'

function firstAllowedView(authUser) {
  if (!authUser) return 'dashboard'
  return VIEW_IDS.find((id) => canAccessView(authUser, id)) ?? 'dashboard'
}

function App() {
  const [users, setUsers] = useState(() => ensureUsersInStorage())
  const [loggedInUserId, setLoggedInUserId] = useState(() => getSessionUserId())
  const [view, setView] = useState('dashboard')

  const authUser = useMemo(() => {
    if (!loggedInUserId) return null
    return resolveSessionUser(loggedInUserId, users)
  }, [loggedInUserId, users])

  const [masterItems, setMasterItems] = useState(() => {
    const loaded = loadJson(storageKeys.master)
    return Array.isArray(loaded) && loaded.length ? loaded : buildSeedMasterItems()
  })
  const [deliveryPlans, setDeliveryPlans] = useState(() => {
    const loaded = loadJson(storageKeys.plans)
    const base = Array.isArray(loaded) && loaded.length ? loaded : buildSeedDeliveryPlans()
    return migrateDeliveryPlansToSimple(base)
  })
  const [inTransit, setInTransit] = useState(() => {
    const loaded = loadJson(storageKeys.transit)
    if (Array.isArray(loaded) && loaded.length) {
      return migrateInTransitRows(loaded)
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

  const appendArrivalLedger = useCallback((entries) => {
    if (!Array.isArray(entries) || !entries.length) return
    setArrivalLedger((prev) => [...prev, ...entries])
  }, [])

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

  useEffect(() => {
    saveJson(storageKeys.master, masterItems)
  }, [masterItems])
  useEffect(() => {
    saveJson(storageKeys.plans, deliveryPlans)
  }, [deliveryPlans])
  useEffect(() => {
    saveJson(storageKeys.transit, inTransit)
  }, [inTransit])
  useEffect(() => {
    saveJson(storageKeys.ops, opsMeta)
  }, [opsMeta])
  useEffect(() => {
    saveJson(storageKeys.weekly, weeklyPlans)
  }, [weeklyPlans])
  useEffect(() => {
    saveJson(storageKeys.starting, startingInventory)
  }, [startingInventory])
  useEffect(() => {
    saveJson(storageKeys.simSource, dataSimSource)
  }, [dataSimSource])
  useEffect(() => {
    saveJson(storageKeys.unitCostsKrw, unitCostKrwBySku)
  }, [unitCostKrwBySku])
  useEffect(() => {
    saveJson(storageKeys.arrivalLedger, arrivalLedger)
  }, [arrivalLedger])

  const resetAllData = useCallback(() => {
    Object.values(storageKeys).forEach((k) => localStorage.removeItem(k))
    setMasterItems(buildSeedMasterItems())
    setDeliveryPlans(migrateDeliveryPlansToSimple(buildSeedDeliveryPlans()))
    setInTransit(buildSeedInTransit())
    setOpsMeta({ ...defaultOpsMeta, asOfDate: getKoreaCalendarDate() })
    setWeeklyPlans(sampleWeeklyPlans)
    setStartingInventory(INITIAL_STARTING_INVENTORY)
    setDataSimSource('sample')
    setUnitCostKrwBySku({})
    setArrivalLedger([])
  }, [])

  const visibleNav = useMemo(
    () =>
      authUser
        ? VIEW_IDS.filter((id) => canAccessView(authUser, id)).map((id) => ({
            id,
            label: formatKoEn(VIEW_LABELS[id]),
          }))
        : [],
    [authUser],
  )

  const goView = useCallback(
    (next) => {
      if (!authUser || !canAccessView(authUser, next)) return
      setView(next)
      window.history.replaceState(null, '', `#/${next}`)
    },
    [authUser],
  )

  useEffect(() => {
    if (!authUser) return
    /* eslint-disable react-hooks/set-state-in-effect -- align view with URL hash after login */
    const raw = window.location.hash.replace(/^#\/?/, '')
    if (raw && VIEW_IDS.includes(raw) && canAccessView(authUser, raw)) {
      setView(raw)
    } else {
      const first = firstAllowedView(authUser)
      setView(first)
      window.history.replaceState(null, '', `#/${first}`)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [authUser])

  useEffect(() => {
    if (!authUser) return
    const onHash = () => {
      const raw = window.location.hash.replace(/^#\/?/, '')
      if (!raw || !VIEW_IDS.includes(raw) || !canAccessView(authUser, raw)) {
        const first = firstAllowedView(authUser)
        window.history.replaceState(null, '', `#/${first}`)
        setView(first)
        return
      }
      setView(raw)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [authUser])

  useEffect(() => {
    if (!authUser) return
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!canAccessView(authUser, view)) {
      const first = firstAllowedView(authUser)
      setView(first)
      window.history.replaceState(null, '', `#/${first}`)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [authUser, view])

  async function handleLogin(userId, password) {
    const u = await authenticate(userId, password, users)
    if (!u) return false
    writeBrowserSessionUserId(u.id)
    setLoggedInUserId(u.id)
    return true
  }

  function handleLogout() {
    clearSession()
    setLoggedInUserId(null)
    setView('dashboard')
    window.history.replaceState(null, '', '#/')
  }

  function handleForceAuthReset() {
    clearAllAuthStorage()
    setUsers(ensureUsersInStorage())
    setLoggedInUserId(null)
    setView('dashboard')
    window.history.replaceState(null, '', '#/')
  }

  if (!authUser) {
    return (
      <div className="app">
        <LoginPage onLogin={handleLogin} />
      </div>
    )
  }

  return (
    <div className="app">
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
            {v.label}
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

      {view === 'dashboard' && (
        <Dashboard
          masterItems={masterItems}
          deliveryPlans={deliveryPlans}
          inTransitContainers={inTransit}
          opsMeta={opsMeta}
          setOpsMeta={setOpsMeta}
          unitCostKrwBySku={unitCostKrwBySku}
          arrivalLedger={arrivalLedger}
        />
      )}
      {view === 'master' && (
        <MasterDataPage
          masterItems={masterItems}
          setMasterItems={setMasterItems}
          deliveryPlans={deliveryPlans}
          inTransit={inTransit}
          opsMeta={opsMeta}
        />
      )}
      {view === 'delivery' && (
        <DeliveryPlanPage
          masterItems={masterItems}
          deliveryPlans={deliveryPlans}
          setDeliveryPlans={setDeliveryPlans}
          opsMeta={opsMeta}
        />
      )}
      {view === 'transit' && (
        <InTransitPage
          inTransit={inTransit}
          setInTransit={setInTransit}
          setMasterItems={setMasterItems}
          opsMeta={opsMeta}
          appendArrivalLedger={appendArrivalLedger}
        />
      )}
      {view === 'projection' && (
        <InventoryProjectionPage
          masterItems={masterItems}
          deliveryPlans={deliveryPlans}
          inTransit={inTransit}
          opsMeta={opsMeta}
        />
      )}
      {view === 'settings' && (
        <SettingsPage
          opsMeta={opsMeta}
          setOpsMeta={setOpsMeta}
          onResetAllData={resetAllData}
          isAdmin={isAdminUser(authUser)}
          users={users}
          setUsers={setUsers}
          currentUserId={authUser.id}
          onForceAuthReset={handleForceAuthReset}
          onNavigateView={goView}
          masterItems={masterItems}
          unitCostKrwBySku={unitCostKrwBySku}
          setUnitCostKrwBySku={setUnitCostKrwBySku}
        />
      )}
    </div>
  )
}

export default App
