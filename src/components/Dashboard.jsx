import { useEffect, useMemo, useState } from 'react'
import { ALL_MODELS_VALUE, getEnabledProducts } from '../config/products'
import { todayShipments as sampleTodayShipments } from '../data/logisticsSampleData'
import { L, formatKoEnInline } from '../i18n/labels'
import { computeWarehouseQtyAsOf, sumWarehouseStockForModelWithAsOf } from '../utils/inventoryAsOf'
import {
  buildInventorySummary,
  buildItemInventoryStatus,
  computePortfolioWeeklyDemandCoverageWeeks,
} from '../utils/inventoryCoverage'
import {
  buildTodayStatus,
  filterByModel,
  getDashboardEtaPortWindowRows,
  isInTransitRowActiveAsOf,
  sumInTransitStockForContainers,
} from '../utils/logisticsMetrics'
import { formatKstDateTime, formatSeattleDateTime, getKoreaCalendarDate } from '../utils/timeZones'
import { inventoryRemoteSyncEnabled } from '../utils/inventoryRemoteSync'
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
  weekConfirmations = {},
  inTransitContainers,
  opsMeta,
  setOpsMeta,
  unitCostKrwBySku,
  arrivalLedger = [],
  /** 휴대폰·PWA: 조회 위주(기준일 수정·주간 ETA 표 숨김) */
  readOnlyMobile = false,
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

  const itemInventoryRows = useMemo(
    () =>
      itemsForModel.map((item) => {
        const warehouseStockQty = computeWarehouseQtyAsOf({
          item,
          deliveryPlans,
          weekConfirmations,
          arrivalLedger,
          asOfDate,
          referenceDate,
        })
        return buildItemInventoryStatus({
          item,
          itemDeliveryPlans: [],
          inTransitContainers: containersAsOf,
          asOfDate,
          warehouseStockQty,
        })
      }),
    [itemsForModel, containersAsOf, asOfDate, deliveryPlans, weekConfirmations, arrivalLedger, referenceDate],
  )

  const inventorySummary = useMemo(() => {
    const portfolioCoverageWeeks = computePortfolioWeeklyDemandCoverageWeeks({
      masterItems: itemsForModel,
      getWarehouseStockQty: (it) =>
        computeWarehouseQtyAsOf({
          item: it,
          deliveryPlans,
          weekConfirmations,
          arrivalLedger,
          asOfDate,
          referenceDate,
        }),
    })
    return buildInventorySummary(itemInventoryRows, { portfolioCoverageWeeks })
  }, [
    itemInventoryRows,
    itemsForModel,
    deliveryPlans,
    weekConfirmations,
    arrivalLedger,
    referenceDate,
  ])

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
        weekConfirmations,
        arrivalLedger,
        asOfDate,
        referenceDate,
      ),
    [
      masterItems,
      selectedModelName,
      unitCostKrwBySku,
      deliveryPlans,
      weekConfirmations,
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

  /** 연속된 동일 컨테이너 No 구간을 교차 배경으로 구분 (짝수 번째 구간에 은은한 톤) */
  const weekEtaRowBands = useMemo(() => {
    if (!weekEtaRows.length) return []
    let groupIdx = -1
    let prevKey = '__INIT__'
    return weekEtaRows.map((row) => {
      const key = String(row?.containerNo ?? '').trim() || '__MISSING__'
      if (key !== prevKey) {
        groupIdx += 1
        prevKey = key
      }
      return groupIdx % 2 === 1
    })
  }, [weekEtaRows])

  const showLedgerHint =
    (!arrivalLedger || arrivalLedger.length === 0) &&
    referenceDate &&
    asOfDate &&
    asOfDate < referenceDate

  const enabledProducts = getEnabledProducts()

  return (
    <div
      className={
        readOnlyMobile ? 'dashboard dashboard--ops dashboard--mobile-readonly' : 'dashboard dashboard--ops'
      }
    >
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">{opsMeta.subtitle}</p>
          <h1>{opsMeta.title}</h1>
          <div className="dashboard__clock-bar" aria-live="polite">
            <div className="dashboard__as-of-item">
              <span className="dashboard__as-of-label">
                <BilingualLabel label={L.dashboardSeattleTime} as="span" />
              </span>
              <span className="dashboard__as-of-value">{seattleClock}</span>
            </div>
            <div className="dashboard__as-of-item">
              <span className="dashboard__as-of-label">
                <BilingualLabel label={L.dashboardKoreaTime} as="span" />
              </span>
              <span className="dashboard__as-of-value">{koreaClock}</span>
            </div>
          </div>
          <div className="dashboard__as-of-inline">
            <BilingualLabel label={L.opsQueryDateKst} as="span" />
            {typeof setOpsMeta === 'function' ? (
              <input
                type="date"
                className="dashboard__as-of-input cell-input"
                value={asOfDate || ''}
                onChange={(e) =>
                  setOpsMeta((o) => ({ ...o, asOfDate: e.target.value || o.asOfDate }))
                }
                aria-label={formatKoEnInline(L.opsQueryDateKst)}
              />
            ) : (
              <time dateTime={asOfDate}>{asOfDate}</time>
            )}
            <span className="tag tag--model">
              {selectedModelName === ALL_MODELS_VALUE ? (
                <BilingualLabel label={L.dashboardModelAll} as="span" />
              ) : (
                selectedModelName
              )}
            </span>
          </div>
          {showLedgerHint && !readOnlyMobile ? (
            <p className="dashboard__as-of-hint" role="note">
              <BilingualLabel label={L.dashboardAsOfLedgerHint} as="span" />
            </p>
          ) : null}
          {!readOnlyMobile ? (
            <p className="dashboard__scope-note">
              <BilingualLabel label={L.multiItemNote} as="span" />
            </p>
          ) : null}
        </div>
        <div className="dashboard__header-actions">
          <label className="dashboard__model-select">
            <BilingualLabel label={L.model} as="span" />
            <select
              value={selectedModelName}
              onChange={(e) => setSelectedModelName(e.target.value)}
              aria-label={formatKoEnInline(L.model)}
            >
              <option value={ALL_MODELS_VALUE} title={formatKoEnInline(L.dashboardModelAll)}>
                {L.dashboardModelAll.ko}
              </option>
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
        thisWeekEtaContainerCount={todayMetrics.thisWeekEtaContainerCount}
        coverageWeeks={
          inventorySummary.portfolioCoverageWeeks ?? inventorySummary.minCoverageWeeks
        }
        unit={opsMeta.unit}
      />
      <p className="dashboard__kpi-footnote page__hint">
        <BilingualLabel
          label={
            inventoryRemoteSyncEnabled() ? L.dashboardInTransitQtyFootnoteRemote : L.dashboardInTransitQtyFootnote
          }
          as="span"
        />
      </p>

      <InventoryStatusPanel
        variant="compact"
        itemRows={itemInventoryRows}
        summary={inventorySummary}
        unit={opsMeta.unit}
      />

      {!readOnlyMobile ? (
      <section className="dashboard__week-eta card" aria-labelledby="dash-week-eta-heading">
        <h2 id="dash-week-eta-heading" className="dashboard__week-eta-title">
          <BilingualLabel label={L.thisWeekEtaSection} as="span" />
        </h2>
        <p className="dashboard__week-eta-hint">
          <BilingualLabel label={L.dashboardWeekEtaDesc} as="span" />
        </p>
        {weekEtaRows.length === 0 ? (
          <p className="dashboard__week-eta-empty">
            <BilingualLabel label={L.dashboardWeekEtaEmpty} as="span" />
          </p>
        ) : (
          <div className="table-wrap dashboard__week-eta-table">
            <table className="ops-table dash-board-table dashboard__week-eta-grid">
              <thead>
                <tr>
                  <th>
                    <BilingualLabel label={L.containerNo} as="span" />
                  </th>
                  <th>
                    <BilingualLabel label={L.model} as="span" />
                  </th>
                  <th>
                    <BilingualLabel label={L.partNo} as="span" />
                  </th>
                  <th className="cell--num">
                    <BilingualLabel label={L.qty} as="span" />
                  </th>
                  <th>
                    <BilingualLabel label={L.dashboardWeekEtaWhCol} as="span" />
                  </th>
                  <th>
                    <BilingualLabel label={L.etaPort} as="span" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {weekEtaRows.map((row, idx) => (
                  <tr
                    key={row.id ?? `${row.containerNo}-${row.partNo}-${idx}`}
                    className={weekEtaRowBands[idx] ? 'week-eta-row--band' : undefined}
                  >
                    <td>{row.containerNo || '—'}</td>
                    <td>{row.modelName}</td>
                    <td>
                      <code>{row.partNo}</code>
                    </td>
                    <td className="cell--num">{formatInt(row.qty)}</td>
                    <td className="dash-board-table__numeric">{row.etaWh || '—'}</td>
                    <td className="dash-board-table__numeric">{row.etaPort || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      ) : null}
    </div>
  )
}
