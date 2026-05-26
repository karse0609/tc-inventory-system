import { useMemo, useState } from 'react'
import {
  getEnabledProducts,
  getPilotProduct,
  PILOT_MODEL_NAME,
} from '../config/products'
import { todayShipments as sampleTodayShipments } from '../data/logisticsSampleData'
import {
  INITIAL_STARTING_INVENTORY,
  weeklyPlans as sampleWeeklyPlans,
} from '../data/sampleInventoryData'
import { L } from '../i18n/labels'
import { formatAsOfDisplay } from '../utils/inventoryHelpers'
import {
  buildInventorySummary,
  buildItemInventoryStatus,
} from '../utils/inventoryCoverage'
import {
  aggregateItemDeliveryPlansByWeek,
  buildTodayStatus,
  filterByModel,
  getThisWeekEtaRows,
} from '../utils/logisticsMetrics'
import BilingualLabel from './BilingualLabel'
import DeliveryPlanTable from './logistics/DeliveryPlanTable'
import InTransitTable from './logistics/InTransitTable'
import InventoryStatusPanel from './logistics/InventoryStatusPanel'
import RawDataPanel from './logistics/RawDataPanel'
import ThisWeekEta from './logistics/ThisWeekEta'
import TodayStatus from './logistics/TodayStatus'
import './Dashboard.css'
import './logistics/ops.css'

const pilotProduct = getPilotProduct()

export default function Dashboard({
  masterItems,
  deliveryPlans,
  inTransitContainers,
  opsMeta,
  weeklyPlans,
  setWeeklyPlans,
  startingInventory,
  setStartingInventory,
  setDataSimSource,
}) {
  const [selectedModelName, setSelectedModelName] = useState(PILOT_MODEL_NAME)
  const asOfDate = opsMeta.asOfDate

  const containers = useMemo(
    () => filterByModel(inTransitContainers, selectedModelName),
    [inTransitContainers, selectedModelName],
  )
  const todayShipments = useMemo(
    () => filterByModel(sampleTodayShipments, selectedModelName),
    [selectedModelName],
  )

  const aggregatedDeliveryPlans = useMemo(
    () =>
      aggregateItemDeliveryPlansByWeek(deliveryPlans, selectedModelName, asOfDate),
    [deliveryPlans, selectedModelName, asOfDate],
  )

  const itemsForModel = useMemo(
    () =>
      filterByModel(masterItems, selectedModelName).filter((i) => i.status !== 'Inactive'),
    [masterItems, selectedModelName],
  )

  const itemPlansForModel = useMemo(
    () => filterByModel(deliveryPlans, selectedModelName),
    [deliveryPlans, selectedModelName],
  )

  const itemInventoryRows = useMemo(
    () =>
      itemsForModel.map((item) =>
        buildItemInventoryStatus({
          item,
          itemDeliveryPlans: itemPlansForModel,
          inTransitContainers: containers,
          asOfDate,
        }),
      ),
    [itemsForModel, itemPlansForModel, containers, asOfDate],
  )

  const inventorySummary = useMemo(
    () => buildInventorySummary(itemInventoryRows),
    [itemInventoryRows],
  )

  const masterItemsForModel = useMemo(
    () => filterByModel(masterItems, selectedModelName),
    [masterItems, selectedModelName],
  )

  const todayMetrics = useMemo(
    () =>
      buildTodayStatus({
        asOfDate,
        todayShipments,
        inTransitContainers: containers,
        itemDeliveryPlans: deliveryPlans,
        modelName: selectedModelName,
        inventorySummary,
        masterItems: masterItemsForModel,
      }),
    [
      asOfDate,
      todayShipments,
      containers,
      deliveryPlans,
      selectedModelName,
      inventorySummary,
      masterItemsForModel,
    ],
  )

  const thisWeekEtaRows = useMemo(
    () => getThisWeekEtaRows(containers, asOfDate),
    [containers, asOfDate],
  )

  const plansForModel = useMemo(
    () =>
      weeklyPlans.filter(
        (p) => (p.modelName ?? PILOT_MODEL_NAME) === selectedModelName,
      ),
    [weeklyPlans, selectedModelName],
  )

  const enabledProducts = getEnabledProducts()

  function handleRestoreSample() {
    setWeeklyPlans(sampleWeeklyPlans)
    setSelectedModelName(PILOT_MODEL_NAME)
    setStartingInventory(INITIAL_STARTING_INVENTORY)
    setDataSimSource('sample')
  }

  return (
    <div className="dashboard dashboard--ops">
      <div className="dashboard__pilot-banner" role="status">
        <div className="dashboard__pilot-main">
          <BilingualLabel label={L.pilotItem} as="span" className="dashboard__pilot-label" />
          <strong className="dashboard__pilot-model">
            Pilot Item: {pilotProduct.modelName}
          </strong>
        </div>
        <p className="dashboard__pilot-note">
          <BilingualLabel label={L.multiItemNote} as="span" />
        </p>
      </div>

      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">{opsMeta.subtitle}</p>
          <h1>{opsMeta.title}</h1>
          <div className="dashboard__as-of-inline">
            <BilingualLabel label={L.asOfDate} as="span" />
            <time dateTime={asOfDate}>{asOfDate}</time>
            <span className="dashboard__as-of-readable">
              {formatAsOfDisplay(asOfDate, opsMeta.timezone)} · {opsMeta.timezoneLabel}
            </span>
            <span className="tag tag--model">{selectedModelName}</span>
          </div>
        </div>
        <div className="dashboard__header-actions">
          <label className="dashboard__model-select">
            <BilingualLabel label={L.model} as="span" />
            <select
              value={selectedModelName}
              onChange={(e) => setSelectedModelName(e.target.value)}
              title="Select model (Multi-SKU)"
            >
              {enabledProducts.map((p) => (
                <option key={p.modelName} value={p.modelName}>
                  {p.displayName}
                  {p.pilot ? ' (Pilot)' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="dashboard__badge">TC TECH</div>
        </div>
      </header>

      <TodayStatus
        metrics={todayMetrics}
        unit={opsMeta.unit}
        currency={opsMeta.currency}
      />

      <div className="ops-grid ops-grid--2">
        <InTransitTable rows={containers} />
        <ThisWeekEta rows={thisWeekEtaRows} weekRange={todayMetrics.weekRange} />
      </div>

      <DeliveryPlanTable plans={aggregatedDeliveryPlans} asOfDate={asOfDate} />

      <InventoryStatusPanel
        itemRows={itemInventoryRows}
        summary={inventorySummary}
        unit={opsMeta.unit}
        currency={opsMeta.currency}
      />

      <RawDataPanel
        selectedModelName={selectedModelName}
        weeklyPlans={plansForModel}
        startingInventory={startingInventory}
        setStartingInventory={setStartingInventory}
        onRestoreSample={handleRestoreSample}
      />
    </div>
  )
}
