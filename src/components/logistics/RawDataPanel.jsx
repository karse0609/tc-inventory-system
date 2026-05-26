import { useState } from 'react'
import { dashboardMeta, historyEvents as allHistoryEvents } from '../../data/sampleInventoryData'
import { L } from '../../i18n/labels'
import { calculateInventorySeries } from '../../utils/calculateInventory'
import BilingualLabel from '../BilingualLabel'
import InventoryChart from '../InventoryChart'

function formatNumber(value) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value))
}

export default function RawDataPanel({
  selectedModelName,
  weeklyPlans,
  startingInventory,
  setStartingInventory,
  onRestoreSample,
}) {
  const [open, setOpen] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('')

  const series = calculateInventorySeries(weeklyPlans, startingInventory)
  const safetyStock = dashboardMeta.safetyStock

  const filteredHistory = allHistoryEvents
    .filter((e) => (e.modelName ?? selectedModelName) === selectedModelName)
    .filter((event) => {
      const q = historyFilter.trim().toLowerCase()
      if (!q) return true
      return (
        event.id.toLowerCase().includes(q) ||
        event.type.toLowerCase().includes(q) ||
        event.memo.toLowerCase().includes(q)
      )
    })

  return (
    <section className="raw-data-panel">
      <button
        type="button"
        className="raw-data-panel__toggle btn btn--ghost"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? (
          <BilingualLabel label={L.hideDataManagement} as="span" />
        ) : (
          <BilingualLabel label={L.showDataManagement} as="span" />
        )}
        <span className="raw-data-panel__hint">
          · <BilingualLabel label={L.dataManagementHint} as="span" />
        </span>
      </button>

      {open && (
        <div className="raw-data-panel__body">
          <p className="page__hint" style={{ marginBottom: '0.75rem' }}>
            Forecast Excel은 <strong>Forecast Upload</strong> 메뉴에서만 적용합니다. Master Data /
            Delivery Plan은 각 관리 화면에서 편집합니다.
          </p>

          <section className="card dashboard__simulation">
            <h3>
              <BilingualLabel
                label={{ ko: '시작 재고 시뮬레이션', en: 'Starting Inventory Simulation' }}
                as="span"
              />
            </h3>
            <div className="simulation__controls">
              <label htmlFor="raw-starting-inventory">
                Starting ({dashboardMeta.unit})
              </label>
              <input
                id="raw-starting-inventory"
                type="range"
                min={0}
                max={20000}
                step={100}
                value={startingInventory}
                onChange={(e) => setStartingInventory(Number(e.target.value))}
              />
              <input
                type="number"
                min={0}
                value={startingInventory}
                onChange={(e) => setStartingInventory(Number(e.target.value) || 0)}
              />
            </div>
            <button type="button" className="btn btn--ghost" onClick={onRestoreSample}>
              <BilingualLabel label={L.restoreSample} as="span" />
            </button>
          </section>

          <InventoryChart series={series} safetyStock={safetyStock} />

          <section className="card">
            <h3>
              <BilingualLabel label={{ ko: '주간 상세', en: 'Weekly Detail' }} as="span" />
            </h3>
            <div className="table-wrap">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Prev Inv.</th>
                    <th>OEI In</th>
                    <th>Weekly Del.</th>
                    <th>NCI</th>
                    <th>End Inv.</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((row) => (
                    <tr key={row.week}>
                      <td>{row.label}</td>
                      <td>{formatNumber(row.previousInventory)}</td>
                      <td>+{formatNumber(row.oeiInbound)}</td>
                      <td>-{formatNumber(row.weeklyOutbound)}</td>
                      <td>{formatNumber(row.nci)}</td>
                      <td>
                        <strong>{formatNumber(row.inventory)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h3>
              <BilingualLabel label={{ ko: '이력', en: 'History' }} as="span" />
            </h3>
            <input
              type="search"
              placeholder="Search…"
              value={historyFilter}
              onChange={(e) => setHistoryFilter(e.target.value)}
            />
            <div className="table-wrap">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((e) => (
                    <tr key={e.id}>
                      <td>{e.id}</td>
                      <td>{e.date}</td>
                      <td>{e.type}</td>
                      <td>{formatNumber(e.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
