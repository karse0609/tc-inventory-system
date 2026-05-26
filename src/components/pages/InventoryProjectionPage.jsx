import { useMemo, useState } from 'react'
import { operationsMeta } from '../../data/logisticsSampleData'
import { L, formatKoEn } from '../../i18n/labels'
import { buildWeekHorizon } from '../../utils/deliveryPlanHorizon'
import {
  buildInventoryProjectionRows,
  shortWeekLabel,
} from '../../utils/inventoryProjection'
import BilingualLabel from '../BilingualLabel'
import '../logistics/ops.css'
import './pages.css'
import './InventoryProjectionPage.css'

function fmtInt(n) {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(Math.round(n))
}

function fmtCov(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n.toFixed(1)} w`
}

const STATUS_LABEL = {
  critical: formatKoEn(L.projectionStatusLabels.critical),
  warning: formatKoEn(L.projectionStatusLabels.warning),
  stable: formatKoEn(L.projectionStatusLabels.stable),
  na: formatKoEn(L.projectionStatusLabels.na),
}

export default function InventoryProjectionPage({
  masterItems,
  deliveryPlans,
  inTransit,
  opsMeta,
}) {
  const asOfDate = opsMeta?.asOfDate ?? operationsMeta.asOfDate
  const [futureWeeks, setFutureWeeks] = useState(12)

  const weekColumns = useMemo(
    () => buildWeekHorizon(asOfDate, 0, futureWeeks),
    [asOfDate, futureWeeks],
  )

  const rows = useMemo(
    () => buildInventoryProjectionRows(masterItems, deliveryPlans, inTransit, weekColumns),
    [masterItems, deliveryPlans, inTransit, weekColumns],
  )

  return (
    <div className="page inv-proj-page">
      <header className="page__header">
        <h1>
          <BilingualLabel label={L.inventoryProjectionScreen} compact as="span" />
        </h1>
        <p className="page__desc">
          <BilingualLabel label={L.inventoryProjectionSubtitle} compact as="span" /> 기준일{' '}
          <strong>{asOfDate}</strong> 포함 앞으로 <strong>{futureWeeks + 1}</strong>주를 표시합니다.
        </p>
        <div className="inv-proj-toolbar">
          <label>
            표시 주차(미래)
            <select
              value={futureWeeks}
              onChange={(e) => setFutureWeeks(Number(e.target.value))}
            >
              <option value={8}>8</option>
              <option value={12}>12</option>
              <option value={16}>16</option>
              <option value={20}>20</option>
              <option value={26}>26</option>
            </select>
          </label>
        </div>
        <p className="inv-proj-legend">
          <BilingualLabel label={L.projectionLegendShort} compact as="span" />
        </p>
      </header>

      <div className="inv-proj-wrap page__table">
        <table className="inv-proj-table">
          <thead>
            <tr>
              <th className="inv-proj-th--sticky inv-proj-col-model">Model</th>
              <th className="inv-proj-th--sticky2 inv-proj-col-part">Part No</th>
              <th className="inv-proj-th--sticky3 inv-proj-col-desc">Description</th>
              <th className="inv-proj-th--sticky4 inv-proj-col-stock">Current Stock</th>
              {weekColumns.map((c) => (
                <th key={c.periodStart} className="inv-proj-week" title={`${c.week} · ${c.periodStart}`}>
                  {shortWeekLabel(c.week)}
                  <span className="inv-proj-week-sub">{c.headerShort}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4 + weekColumns.length} className="empty">
                  Master에 활성 품목이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
              <tr key={r.id}>
                <td className="inv-proj-td--sticky inv-proj-col-model">{r.modelName}</td>
                <td className="inv-proj-td--sticky2 inv-proj-col-part">
                  <code>{r.partNo}</code>
                </td>
                <td className="inv-proj-td--sticky3 inv-proj-col-desc" title={r.description}>
                  {r.description}
                </td>
                <td className="inv-proj-td--sticky4 inv-proj-col-stock">
                  <div className="inv-proj-opening">
                    <div>
                      <span className="inv-proj-opening__tag">W</span>
                      {fmtInt(r.currentStock)}
                    </div>
                    <div className="inv-proj-opening--muted" title={formatKoEn(L.warehousePipelineAbbr)}>
                      <span className="inv-proj-opening__tag">T</span>
                      {fmtInt(r.inTransitPipeline ?? 0)}
                    </div>
                  </div>
                </td>
                {weekColumns.map((c) => {
                  const cell = r.weeks[c.periodStart]
                  const st = cell?.status ?? 'na'
                  return (
                    <td
                      key={c.periodStart}
                      className={`inv-proj-week inv-proj-cell inv-proj-cell--${st}`}
                    >
                      <span className="inv-proj-cell__line">
                        <span className="inv-proj-cell__label">Inv</span>
                        {fmtInt(cell?.projected ?? 0)}
                      </span>
                      <span className="inv-proj-cell__line">
                        <span className="inv-proj-cell__label">Cov</span>
                        {fmtCov(cell?.coverageWeeks)}
                      </span>
                      <span className="inv-proj-cell__line">
                        <span className="inv-proj-cell__label">Gap</span>
                        {fmtInt(cell?.gap ?? 0)}
                      </span>
                      <span className={`inv-proj-status inv-proj-status--${st}`}>
                        {STATUS_LABEL[st] ?? st}
                      </span>
                    </td>
                  )
                })}
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
