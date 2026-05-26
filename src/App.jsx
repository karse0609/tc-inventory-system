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
import { canAccessView, isAdminUser } from './utils/permissions'
import LoginPage from './components/auth/LoginPage.jsx'
import Dashboard from './components/Dashboard.jsx'
import MasterDataPage from './components/pages/MasterDataPage.jsx'
import DeliveryPlanPage from './components/pages/DeliveryPlanPage.jsx'
import InTransitPage from './components/pages/InTransitPage.jsx'
import ForecastUploadPage from './components/pages/ForecastUploadPage.jsx'
import SettingsPage from './components/pages/SettingsPage.jsx'
import './App.css'
import './components/pages/pages.css'

const VIEWS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'master', label: 'Master Data' },
  { id: 'delivery', label: 'Delivery Plan' },
  { id: 'transit', label: 'In-Transit' },
  { id: 'forecast', label: 'Forecast Upload' },
  { id: 'settings', label: 'Settings' },
]

function firstAllowedView(authUser) {
  return VIEWS.find((v) => canAccessView(authUser, v.id))?.id ?? 'dashboard'
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
    return Array.isArray(loaded) && loaded.length ? loaded : buildSeedDeliveryPlans()
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
    return loaded && typeof loaded === 'object' ? { ...defaultOpsMeta, ...loaded } : defaultOpsMeta
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

  const resetAllData = useCallback(() => {
    Object.values(storageKeys).forEach((k) => localStorage.removeItem(k))
    setMasterItems(buildSeedMasterItems())
    setDeliveryPlans(buildSeedDeliveryPlans())
    setInTransit(buildSeedInTransit())
    setOpsMeta(defaultOpsMeta)
    setWeeklyPlans(sampleWeeklyPlans)
    setStartingInventory(INITIAL_STARTING_INVENTORY)
    setDataSimSource('sample')
  }, [])

  const visibleNav = useMemo(
    () => VIEWS.filter((v) => authUser && canAccessView(authUser, v.id)),
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
    if (raw && VIEWS.some((v) => v.id === raw) && canAccessView(authUser, raw)) {
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
      if (!raw || !VIEWS.some((v) => v.id === raw) || !canAccessView(authUser, raw)) {
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
        <span className="app-nav__brand">TC Inventory</span>
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
          weeklyPlans={weeklyPlans}
          setWeeklyPlans={setWeeklyPlans}
          startingInventory={startingInventory}
          setStartingInventory={setStartingInventory}
          setDataSimSource={setDataSimSource}
        />
      )}
      {view === 'master' && (
        <MasterDataPage masterItems={masterItems} setMasterItems={setMasterItems} />
      )}
      {view === 'delivery' && (
        <DeliveryPlanPage
          masterItems={masterItems}
          deliveryPlans={deliveryPlans}
          setDeliveryPlans={setDeliveryPlans}
        />
      )}
      {view === 'transit' && (
        <InTransitPage
          inTransit={inTransit}
          setInTransit={setInTransit}
          setMasterItems={setMasterItems}
        />
      )}
      {view === 'forecast' && (
        <ForecastUploadPage
          masterItems={masterItems}
          deliveryPlans={deliveryPlans}
          setDeliveryPlans={setDeliveryPlans}
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
        />
      )}
    </div>
  )
}

export default App
