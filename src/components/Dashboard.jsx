import { useMemo, useState } from 'react'
import { getEnabledProducts, PILOT_MODEL_NAME } from '../config/products'
import { todayShipments as sampleTodayShipments } from '../data/logisticsSampleData'
import { L } from '../i18n/labels'
import { formatAsOfDisplay } from '../utils/inventoryHelpers'
import {
  buildInventorySummary,
  buildItemInventoryStatus,
} from '../utils/inventoryCoverage'
import {
  buildTodayStatus,
  countDelayedInTransitContainers,
  filterByModel,
  sumInTransitStockForContainers,
  sumWarehouseStockForModel,
} from '../utils/logisticsMetrics'
import BilingualLabel from './BilingualLabel'
import DashboardCoreKpis from './logistics/DashboardCoreKpis'
import InventoryStatusPanel from './logistics/InventoryStatusPanel'
import './Dashboard.css'
import './logistics/ops.css'

export default function Dashboard({
  masterItems,
  deliveryPlans,
  inTransitContainers,
  opsMeta,
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

  const warehouse = useMemo(
    () => sumWarehouseStockForModel(masterItems, selectedModelName),
    [masterItems, selectedModelName],
  )

  const inTransitTotals = useMemo(
    () => sumInTransitStockForContainers(containers, masterItems),
    [containers, masterItems],
  )

  const delayedCount = useMemo(
    () => countDelayedInTransitContainers(containers, asOfDate),
    [containers, asOfDate],
  )

  const enabledProducts = getEnabledProducts()

  return (
    <div className="dashboard dashboard--ops">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">{opsMeta.subtitle}</p>
          <h1>{opsMeta.title}</h1>
          <div className="dashboard__as-of-inline">
            <BilingualLabel label={L.asOfDate} compact as="span" />
            <time dateTime={asOfDate}>{asOfDate}</time>
            <span className="dashboard__as-of-readable">
              {formatAsOfDisplay(asOfDate, opsMeta.timezone)} · {opsMeta.timezoneLabel}
            </span>
            <span className="tag tag--model">{selectedModelName}</span>
          </div>
          <p className="dashboard__scope-note">
            <BilingualLabel label={L.multiItemNote} as="span" />
          </p>
        </div>
        <div className="dashboard__header-actions">
          <label className="dashboard__model-select">
            <BilingualLabel label={L.model} compact as="span" />
            <select
              value={selectedModelName}
              onChange={(e) => setSelectedModelName(e.target.value)}
              aria-label="Model"
            >
              {enabledProducts.map((p) => (
                <option key={p.modelName} value={p.modelName}>
                  {p.displayName}
                  {p.pilot ? ' (Pilot)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <DashboardCoreKpis
        warehouseQty={warehouse.qty}
        warehouseValue={warehouse.value}
        inTransitQty={inTransitTotals.qty}
        inTransitValue={inTransitTotals.value}
        thisWeekEtaQty={todayMetrics.thisWeekEtaQty}
        coverageWeeks={inventorySummary.minCoverageWeeks}
        delayedContainerCount={delayedCount}
        unit={opsMeta.unit}
        currency={opsMeta.currency}
      />

      <InventoryStatusPanel
        variant="compact"
        itemRows={itemInventoryRows}
        summary={inventorySummary}
        unit={opsMeta.unit}
        currency={opsMeta.currency}
      />
    </div>
  )
}
