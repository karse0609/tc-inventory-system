import { useEffect, useMemo, useState } from 'react'
import { ALL_MODELS_VALUE } from '../config/products'
import { todayShipments as sampleTodayShipments } from '../data/logisticsSampleData'
import { L, formatKoEnInline } from '../i18n/labels'
import { skuCostKey } from '../utils/unitCostKrw'
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
import { collectOperationalModelNames } from '../utils/dashboardModelOptions'
import {
  auditNonOperationalModels,
  isOperationalModelName,
  modelsMatch,
  normalizeModel,
} from '../utils/modelName'
import BilingualLabel from './BilingualLabel'
import DashboardCoreKpis from './logistics/DashboardCoreKpis'
import DashboardRoleGuidance from './logistics/DashboardRoleGuidance'
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
  /** Admin: 시스템·저장소 안내 / 일반 사용자: 사용 안내 */
  isAdminViewer = false,
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

  const allInTransitAsOf = useMemo(
    () =>
      (inTransitContainers || []).filter((r) =>
        isInTransitRowActiveAsOf(r, asOfDate, referenceDate),
      ),
    [inTransitContainers, asOfDate, referenceDate],
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
        /** 품번별 표의 현재재고 = 창고 재고(Master) Current Stock 그대로 (조회기준일 역산·출고계획 합산 없음) */
        const warehouseStockQty = Math.max(0, Number(item.currentStock) || 0)
        return buildItemInventoryStatus({
          item,
          itemDeliveryPlans: [],
          inTransitContainers: containersAsOf,
          inTransitByPartNoContainers: allInTransitAsOf,
          asOfDate,
          warehouseStockQty,
        })
      }),
    [
      itemsForModel,
      containersAsOf,
      allInTransitAsOf,
      asOfDate,
    ],
  )

  const inventorySummary = useMemo(() => {
    const portfolioCoverageWeeks = computePortfolioWeeklyDemandCoverageWeeks({
      masterItems: itemsForModel,
      getWarehouseStockQty: (it) => Math.max(0, Number(it.currentStock) || 0),
    })
    return buildInventorySummary(itemInventoryRows, { portfolioCoverageWeeks })
  }, [
    itemInventoryRows,
    itemsForModel,
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

  const warehouse = useMemo(() => {
    const rows = filterByModel(masterItems, selectedModelName).filter((r) => r.status !== 'Inactive')
    const map = unitCostKrwBySku && typeof unitCostKrwBySku === 'object' ? unitCostKrwBySku : {}
    let qty = 0
    let value = 0
    for (const r of rows) {
      const q = Math.max(0, Number(r.currentStock) || 0)
      const cost = Math.max(0, Number(map[skuCostKey(r.modelName, r.partNo)]) || 0)
      qty += q
      value += q * cost
    }
    return { qty, value }
  }, [masterItems, selectedModelName, unitCostKrwBySku])

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

  const dashboardModelNames = useMemo(
    () =>
      collectOperationalModelNames({
        masterItems,
        inTransitContainers,
        deliveryPlans,
      }),
    [masterItems, inTransitContainers, deliveryPlans],
  )

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const flagged = auditNonOperationalModels({
      masterItems,
      inTransitContainers,
      deliveryPlans,
    })
    if (flagged.length) {
      console.info('[TC Inventory] Non-operational model values in loaded data:', flagged)
    }
  }, [masterItems, inTransitContainers, deliveryPlans])

  const dashboardModelSelectOptions = useMemo(() => {
    const names = [...dashboardModelNames]
    if (selectedModelName === ALL_MODELS_VALUE || !selectedModelName) return names
    const norm = normalizeModel(selectedModelName)
    if (
      isOperationalModelName(norm) &&
      !names.some((n) => modelsMatch(n, selectedModelName))
    ) {
      names.push(norm)
      names.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    }
    return names
  }, [dashboardModelNames, selectedModelName])

  return (
    <div className="dashboard dashboard--ops">
      <header className="dashboard__header">
        <div className="dashboard__header-main">
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
          <div className="dashboard__query-row">
            <label className="dashboard__query-field">
              <span className="dashboard__query-field-label">
                <BilingualLabel label={L.opsQueryDateKst} as="span" />
              </span>
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
                <time className="dashboard__as-of-readonly" dateTime={asOfDate}>
                  {asOfDate}
                </time>
              )}
            </label>
            <label className="dashboard__query-field">
              <span className="dashboard__query-field-label">
                <BilingualLabel label={L.model} as="span" />
              </span>
              <select
                className="dashboard__model-select-input cell-input"
                value={selectedModelName}
                onChange={(e) => setSelectedModelName(e.target.value)}
                aria-label={formatKoEnInline(L.model)}
              >
                <option value={ALL_MODELS_VALUE} title={formatKoEnInline(L.dashboardModelAll)}>
                  {L.dashboardModelAll.ko}
                </option>
                {dashboardModelSelectOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
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

      <DashboardRoleGuidance
        isAdmin={isAdminViewer}
        showLedgerHint={showLedgerHint}
        inventoryRemoteSyncEnabled={inventoryRemoteSyncEnabled()}
      />

      <InventoryStatusPanel
        variant="compact"
        itemRows={itemInventoryRows}
        summary={inventorySummary}
        unit={opsMeta.unit}
      />

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
    </div>
  )
}
