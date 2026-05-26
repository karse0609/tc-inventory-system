import { useCallback, useEffect, useState } from 'react'
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

function App() {
  const [view, setView] = useState('dashboard')

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
    return Array.isArray(loaded) && loaded.length ? loaded : buildSeedInTransit()
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

  return (
    <div className="app">
      <nav className="app-nav" aria-label="Main">
        <span className="app-nav__brand">TC Inventory</span>
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`app-nav__btn ${view === v.id ? 'app-nav__btn--active' : ''}`}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
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
      {view === 'transit' && <InTransitPage inTransit={inTransit} setInTransit={setInTransit} />}
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
        />
      )}
    </div>
  )
}

export default App
