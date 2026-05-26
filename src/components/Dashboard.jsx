import { useEffect, useMemo, useState } from 'react'
import { ALL_MODELS_VALUE, getEnabledProducts } from '../config/products'
import { todayShipments as sampleTodayShipments } from '../data/logisticsSampleData'
import { L, formatKoEn } from '../i18n/labels'
import { computeWarehouseQtyAsOf, sumWarehouseStockForModelWithAsOf } from '../utils/inventoryAsOf'
import {
  buildInventorySummary,
  buildItemInventoryStatus,
} from '../utils/inventoryCoverage'
import {
  buildTodayStatus,
  filterByModel,
  getDashboardEtaPortWindowRows,
  isInTransitRowActiveAsOf,
  sumInTransitStockForContainers,
} from '../utils/logisticsMetrics'
import { formatKstDateTime, formatSeattleDateTime, getKoreaCalendarDate } from '../utils/timeZones'
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
  unitCostKrwBySku,
  arrivalLedger = [],
}) {
  const [selectedModelName, setSelectedModelName] = useState(ALL_MODELS_VALUE)
  const [clockTick, setClockTick] = useState(() => new Date())
  const [referenceDate, setReferenceDate] = useState(() => getKoreaCalendarDate())

  useEffect(() => {
    const clockId = window.setInterval(() => setClockTick(new Date()), 1000)
    const refId = window.setInterval(() => setReferenceDate(getKoreaCalendarDate()), 60_000)
    return () => {
      window.clearInterval(clockId)
      window.clearInterval(refId)
    }
  }, [])

  const asOfDate = opsMeta.asOfDate
  const seattleClock = formatSeattleDateTime(clockTick)
  const koreaClock = formatKstDateTime(clockTick)

  const containers = useMemo(
    () => filterByModel(inTransitContainers, selectedModelName),
    [inTransitContainers, selectedModelName],
  )

  const containersAsOf = useMemo(
    () => containers.filter((r) => isInTransitRowActiveAsOf(r, asOfDate, referenceDate)),
    [containers, asOfDate, referenceDate],
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
      itemsForModel.map((item) => {
        const warehouseStockQty = computeWarehouseQtyAsOf({
          item,
          deliveryPlans,
          arrivalLedger,
          asOfDate,
          referenceDate,
        })
        return buildItemInventoryStatus({
          item,
          itemDeliveryPlans: itemPlansForModel,
          inTransitContainers: containersAsOf,
          asOfDate,
          warehouseStockQty,
        })
      }),
    [
      itemsForModel,
      itemPlansForModel,
      containersAsOf,
      asOfDate,
      deliveryPlans,
      arrivalLedger,
      referenceDate,
    ],
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
        inTransitContainers: containersAsOf,
        itemDeliveryPlans: deliveryPlans,
        modelName: selectedModelName,
        inventorySummary,
        masterItems: masterItemsForModel,
      }),
    [
      asOfDate,
      todayShipments,
      containersAsOf,
      deliveryPlans,
      selectedModelName,
      inventorySummary,
      masterItemsForModel,
    ],
  )

  const warehouse = useMemo(
    () =>
      sumWarehouseStockForModelWithAsOf(
        masterItems,
        selectedModelName,
        unitCostKrwBySku,
        deliveryPlans,
        arrivalLedger,
        asOfDate,
        referenceDate,
      ),
    [
      masterItems,
      selectedModelName,
      unitCostKrwBySku,
      deliveryPlans,
      arrivalLedger,
      asOfDate,
      referenceDate,
    ],
  )

  const inTransitTotals = useMemo(
    () => sumInTransitStockForContainers(containersAsOf, unitCostKrwBySku),
    [containersAsOf, unitCostKrwBySku],
  )

  const weekEtaRows = useMemo(
    () => getDashboardEtaPortWindowRows(containersAsOf, asOfDate),
    [containersAsOf, asOfDate],
  )

  const showLedgerHint =
    (!arrivalLedger || arrivalLedger.length === 0) &&
    referenceDate &&
    asOfDate &&
    asOfDate < referenceDate

  const enabledProducts = getEnabledProducts()

  const modelTag =
    selectedModelName === ALL_MODELS_VALUE ? formatKoEn(L.dashboardModelAll) : selectedModelName

  return (
    <div className="dashboard dashboard--ops">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">{opsMeta.subtitle}</p>
          <h1>{opsMeta.title}</h1>
          <div className="dashboard__clock-bar" aria-live="polite">
            <div className="dashboard__as-of-item">
              <span className="dashboard__as-of-label">
                <BilingualLabel label={L.dashboardSeattleTime} compact as="span" />
              </span>
              <span className="dashboard__as-of-value">{seattleClock}</span>
            </div>
            <div className="dashboard__as-of-item">
              <span className="dashboard__as-of-label">
                <BilingualLabel label={L.dashboardKoreaTime} compact as="span" />
              </span>
              <span className="dashboard__as-of-value">{koreaClock}</span>
            </div>
          </div>
          <div className="dashboard__as-of-inline">
            <BilingualLabel label={L.opsQueryDateKst} compact as="span" />
            {typeof setOpsMeta === 'function' ? (
              <input
                type="date"
                className="dashboard__as-of-input cell-input"
                value={asOfDate || ''}
                onChange={(e) =>
                  setOpsMeta((o) => ({ ...o, asOfDate: e.target.value || o.asOfDate }))
                }
                aria-label={formatKoEn(L.opsQueryDateKst)}
              />
            ) : (
              <time dateTime={asOfDate}>{asOfDate}</time>
            )}
            <span className="tag tag--model">{modelTag}</span>
          </div>
          {showLedgerHint ? (
            <p className="dashboard__as-of-hint" role="note">
              <BilingualLabel label={L.dashboardAsOfLedgerHint} compact as="span" />
            </p>
          ) : null}
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
      />

      <InventoryStatusPanel
        variant="compact"
        itemRows={itemInventoryRows}
        summary={inventorySummary}
        unit={opsMeta.unit}
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
