import { useMemo, useState } from 'react'
import { ALL_MODELS_VALUE, getEnabledProducts } from '../config/products'
import { todayShipments as sampleTodayShipments } from '../data/logisticsSampleData'
import { L, formatKoEn } from '../i18n/labels'
import { formatAsOfDisplay } from '../utils/inventoryHelpers'
import {
  buildInventorySummary,
  buildItemInventoryStatus,
} from '../utils/inventoryCoverage'
import {
  buildTodayStatus,
  filterByModel,
  getThisWeekEtaRows,
  sumInTransitStockForContainers,
  sumWarehouseStockForModel,
} from '../utils/logisticsMetrics'
import BilingualLabel from './BilingualLabel'
import DashboardCoreKpis from './logistics/DashboardCoreKpis'
import InventoryStatusPanel from './logistics/InventoryStatusPanel'
import './Dashboard.css'
import './logistics/ops.css'

function formatInt(n) {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(
    Math.round(Number(n) || 0),
  )
}

export default function Dashboard({
  masterItems,
  deliveryPlans,
  inTransitContainers,
  opsMeta,
  setOpsMeta,
}) {
  const [selectedModelName, setSelectedModelName] = useState(ALL_MODELS_VALUE)
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

  const weekEtaRows = useMemo(
    () => getThisWeekEtaRows(containers, asOfDate),
    [containers, asOfDate],
  )

  const enabledProducts = getEnabledProducts()

  const modelTag =
    selectedModelName === ALL_MODELS_VALUE ? formatKoEn(L.dashboardModelAll) : selectedModelName

  return (
    <div className="dashboard dashboard--ops">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">{opsMeta.subtitle}</p>
          <h1>{opsMeta.title}</h1>
          <div className="dashboard__as-of-inline">
            <BilingualLabel label={L.asOfDate} compact as="span" />
            {typeof setOpsMeta === 'function' ? (
              <input
                type="date"
                className="dashboard__as-of-input cell-input"
                value={asOfDate || ''}
                onChange={(e) =>
                  setOpsMeta((o) => ({ ...o, asOfDate: e.target.value || o.asOfDate }))
                }
                aria-label={formatKoEn(L.asOfDate)}
              />
            ) : (
              <time dateTime={asOfDate}>{asOfDate}</time>
            )}
            <span className="dashboard__as-of-readable">
              {formatAsOfDisplay(asOfDate, opsMeta.timezone)} · {opsMeta.timezoneLabel}
            </span>
            <span className="tag tag--model">{modelTag}</span>
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
              <option value={ALL_MODELS_VALUE}>{formatKoEn(L.dashboardModelAll)}</option>
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

      <section className="dashboard__week-eta card" aria-labelledby="dash-week-eta-heading">
        <h2 id="dash-week-eta-heading" className="dashboard__week-eta-title">
          <BilingualLabel label={L.thisWeekEtaSection} compact as="span" />
        </h2>
        <p className="dashboard__week-eta-hint">
          <BilingualLabel label={L.dashboardWeekEtaDesc} compact as="span" />
        </p>
        {weekEtaRows.length === 0 ? (
          <p className="dashboard__week-eta-empty">
            <BilingualLabel label={L.dashboardWeekEtaEmpty} compact as="span" />
          </p>
        ) : (
          <div className="table-wrap dashboard__week-eta-table">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>
                    <BilingualLabel label={L.containerNo} compact as="span" />
                  </th>
                  <th>
                    <BilingualLabel label={L.model} compact as="span" />
                  </th>
                  <th>
                    <BilingualLabel label={L.partNo} compact as="span" />
                  </th>
                  <th className="cell--num">
                    <BilingualLabel label={L.qty} compact as="span" />
                  </th>
                  <th>
                    <BilingualLabel label={L.dashboardWeekEtaWhCol} compact as="span" />
                  </th>
                  <th>
                    <BilingualLabel label={L.etaPort} compact as="span" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {weekEtaRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.containerNo || '—'}</td>
                    <td>{row.modelName}</td>
                    <td>
                      <code>{row.partNo}</code>
                    </td>
                    <td className="cell--num">{formatInt(row.qty)}</td>
                    <td>{row.etaWh || '—'}</td>
                    <td>{row.etaPort || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
