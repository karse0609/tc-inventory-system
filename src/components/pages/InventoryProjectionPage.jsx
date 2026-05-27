import { useCallback, useMemo, useState } from 'react'
import { operationsMeta } from '../../data/logisticsSampleData'
import { L, formatKoEn, formatKoEnInline } from '../../i18n/labels'
import { buildWeekHorizon } from '../../utils/deliveryPlanHorizon'
import {
  buildInventoryProjectionRows,
  shortWeekLabel,
} from '../../utils/inventoryProjection'
import { downloadXlsxFromAoA } from '../../utils/excelFile'
import { useMobileSimpleLayout } from '../../utils/mobileLayout'
import { inventoryRemoteSyncEnabled } from '../../utils/inventoryRemoteSync'
import PageDataToolbar from '../grid/PageDataToolbar.jsx'
import BilingualLabel from '../BilingualLabel'
import '../logistics/ops.css'
import './pages.css'
import './InventoryProjectionPage.css'

function fmtInt(n) {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(Math.round(n))
}

function fmtCov(n) {
  if (n === Infinity) return '∞'
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n.toFixed(1)} w`
}

const EMPTY = { model: '', part: '' }

function lc(s) {
  return String(s ?? '').toLowerCase()
}

function rowMatchesProj(row, applied) {
  if (applied.model && !lc(row.modelName).includes(applied.model)) return false
  if (applied.part && !lc(row.partNo).includes(applied.part)) return false
  return true
}

export default function InventoryProjectionPage({
  masterItems,
  deliveryPlans,
  weekConfirmations = {},
  inTransit,
  opsMeta,
}) {
  const isMobile = useMobileSimpleLayout()
  const asOfDate = opsMeta?.asOfDate ?? operationsMeta.asOfDate
  const [futureWeeks, setFutureWeeks] = useState(12)
  const [searchModel, setSearchModel] = useState('')
  const [searchPart, setSearchPart] = useState('')
  const [applied, setApplied] = useState(() => ({ ...EMPTY }))
  const [excelMsg, setExcelMsg] = useState('')

  const weekColumns = useMemo(
    () => buildWeekHorizon(asOfDate, 0, futureWeeks),
    [asOfDate, futureWeeks],
  )

  const rows = useMemo(
    () =>
      buildInventoryProjectionRows(
        masterItems,
        deliveryPlans,
        weekConfirmations,
        inTransit,
        weekColumns,
      ),
    [masterItems, deliveryPlans, weekConfirmations, inTransit, weekColumns],
  )

  const displayedRows = useMemo(
    () => rows.filter((r) => rowMatchesProj(r, applied)),
    [rows, applied],
  )

  const handleDownload = useCallback(() => {
    setExcelMsg('')
    const header = [
      'Model',
      'Part No',
      'Description',
      'Current Stock',
      'In-transit pipeline',
    ]
    for (const c of weekColumns) {
      const h = `${shortWeekLabel(c.week)} ${c.headerShort ?? ''}`.trim()
      header.push(`${h} Inv`, `${h} Cov`, `${h} Gap`, `${h} Status`)
    }
    const body = displayedRows.map((r) => {
      const cells = [
        r.modelName,
        r.partNo,
        r.description ?? '',
        String(r.currentStock ?? ''),
        String(r.inTransitPipeline ?? ''),
      ]
      for (const c of weekColumns) {
        const cell = r.weeks[c.periodStart]
        const st = cell?.status
        cells.push(
          String(Math.round(cell?.projected ?? 0)),
          fmtCov(cell?.coverageWeeks),
          String(Math.round(cell?.gap ?? 0)),
          st ? String(st) : '',
        )
      }
      return cells
    })
    downloadXlsxFromAoA('InventoryProjection', 'Projection', [header, ...body])
    setExcelMsg(formatKoEn(L.excelExportDone))
    setTimeout(() => setExcelMsg(''), 2500)
  }, [displayedRows, weekColumns])

  return (
    <div className="page inv-proj-page">
      <header className="page__header">
        <h1>
          <BilingualLabel label={L.inventoryProjectionScreen} as="span" />
        </h1>
        <p className="page__desc">
          <BilingualLabel
            label={
              inventoryRemoteSyncEnabled() ? L.inventoryProjectionSubtitleRemote : L.inventoryProjectionSubtitle
            }
            as="span"
          />{' '}
          기준일{' '}
          <strong>{asOfDate}</strong> 포함 앞으로 <strong>{futureWeeks + 1}</strong>주를 표시합니다.
        </p>
        <PageDataToolbar
          hideUpload
          hideSave
          hideDownload={isMobile}
          onDownload={handleDownload}
          downloadDisabled={displayedRows.length === 0}
          message={excelMsg}
          extra={
            <label className="inv-proj-toolbar inv-proj-toolbar--inline">
              <span>
                <BilingualLabel label={L.projectionFutureWeeksLabel} as="span" />
              </span>
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
          }
          searchSlot={
            <form
              className="page-search-strip"
              onSubmit={(e) => {
                e.preventDefault()
                setApplied({
                  model: searchModel.trim().toLowerCase(),
                  part: searchPart.trim().toLowerCase(),
                })
              }}
            >
              <div className="page-search-strip__fields">
                <label className="page-search-strip__field">
                  <span className="page-search-strip__label">
                    <BilingualLabel label={L.pageSearchModel} as="span" />
                  </span>
                  <input
                    className="cell-input"
                    value={searchModel}
                    onChange={(e) => setSearchModel(e.target.value)}
                    aria-label={formatKoEnInline(L.pageSearchModel)}
                  />
                </label>
                <label className="page-search-strip__field">
                  <span className="page-search-strip__label">
                    <BilingualLabel label={L.pageSearchPartNo} as="span" />
                  </span>
                  <input
                    className="cell-input"
                    value={searchPart}
                    onChange={(e) => setSearchPart(e.target.value)}
                    aria-label={formatKoEnInline(L.pageSearchPartNo)}
                  />
                </label>
              </div>
              <div className="page-search-strip__actions">
                <button type="submit" className="btn btn--primary btn--toolbar">
                  <BilingualLabel label={L.pageSearchButton} as="span" />
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--toolbar"
                  onClick={() => {
                    setSearchModel('')
                    setSearchPart('')
                    setApplied({ ...EMPTY })
                  }}
                >
                  <BilingualLabel label={L.pageSearchReset} as="span" />
                </button>
              </div>
            </form>
          }
        />
        <p className="inv-proj-legend">
          <BilingualLabel label={L.projectionLegendShort} as="span" />
        </p>
        <p className="inv-proj-legend inv-proj-legend--risk">
          <BilingualLabel label={L.projectionLegendRiskBands} as="span" />
        </p>
        <p className="inv-proj-legend inv-proj-legend--scope">
          <BilingualLabel label={L.projectionLegendStatusScope} as="span" />
        </p>
      </header>

      <div className="inv-proj-wrap page__table">
        <table className="inv-proj-table">
          <thead>
            <tr>
              <th className="inv-proj-th--sticky inv-proj-col-model">
                <BilingualLabel label={L.model} as="span" />
              </th>
              <th className="inv-proj-th--sticky2 inv-proj-col-part">
                <BilingualLabel label={L.partNo} as="span" />
              </th>
              <th className="inv-proj-th--sticky3 inv-proj-col-desc">
                <BilingualLabel label={L.description} as="span" />
              </th>
              <th className="inv-proj-th--sticky4 inv-proj-col-stock">
                <BilingualLabel label={L.currentStock} as="span" />
              </th>
              {weekColumns.map((c) => (
                <th key={c.periodStart} className="inv-proj-week" title={`${c.week} · ${c.periodStart}`}>
                  {shortWeekLabel(c.week)}
                  <span className="inv-proj-week-sub">{c.headerShort}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayedRows.length === 0 ? (
              <tr>
                <td colSpan={4 + weekColumns.length} className="empty">
                  Master에 활성 품목이 없습니다.
                </td>
              </tr>
            ) : (
              displayedRows.map((r) => (
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
                      <div className="inv-proj-opening--muted" title={formatKoEnInline(L.warehousePipelineAbbr)}>
                        <span className="inv-proj-opening__tag">T</span>
                        {fmtInt(r.inTransitPipeline ?? 0)}
                      </div>
                    </div>
                  </td>
                  {weekColumns.map((c) => {
                    const cell = r.weeks[c.periodStart]
                    const st = cell?.status
                    const tone = st ?? 'neutral'
                    return (
                      <td
                        key={c.periodStart}
                        className={`inv-proj-week inv-proj-cell inv-proj-cell--${tone}`}
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
                        {st ? (
                          <span className={`inv-proj-status inv-proj-status--${st}`}>
                            <BilingualLabel
                              compact
                              className="inv-proj-status__bi"
                              enClassName="inv-proj-status__en"
                              label={L.projectionStatusLabels[st]}
                              as="span"
                            />
                          </span>
                        ) : null}
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
