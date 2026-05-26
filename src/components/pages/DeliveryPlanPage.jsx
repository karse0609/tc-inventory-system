import { useCallback, useEffect, useMemo, useState } from 'react'
import BilingualLabel from '../BilingualLabel'
import { operationsMeta } from '../../data/logisticsSampleData'
import { formatKoEn, L } from '../../i18n/labels'
import { saveJson, storageKeys } from '../../utils/appPersistence'
import { buildWeekHorizon, planWeekMonday } from '../../utils/deliveryPlanHorizon'
import { getWeekRange } from '../../utils/logisticsMetrics'
import { newId } from '../../utils/newId'
import '../logistics/ops.css'
import './pages.css'
import './DeliveryPlanPage.css'

const DEFAULT_PAST = 2
const DEFAULT_FUTURE = 22
const MAX_PAST_WEEKS = 52

/** 향후 주 잠금 UI — true로 바꾸면 정책상 미래 주 편집 비활성화 */
const FUTURE_WEEKS_LOCKED = false

function weekStartFromCol(col) {
  return col.weekStartDate || col.periodStart
}

function mergeCellUpdate(plans, modelName, partNo, weekStartDate, rawValue) {
  const idx = plans.findIndex(
    (p) =>
      p.modelName === modelName &&
      p.partNo === partNo &&
      planWeekMonday(p) === weekStartDate,
  )
  const prev = idx >= 0 ? plans[idx] : {}

  const qty =
    rawValue === '' || rawValue === null || rawValue === undefined
      ? 0
      : Number(rawValue) || 0

  if (qty === 0 && idx >= 0) return plans.filter((_, i) => i !== idx)
  if (qty === 0) return plans

  const row = {
    id: idx >= 0 ? prev.id : newId('plan'),
    modelName,
    partNo,
    weekStartDate,
    qty,
    locked: idx >= 0 ? prev.locked === true : false,
  }
  if (idx >= 0) return plans.map((p, i) => (i === idx ? row : p))
  return [...plans, row]
}

function buildPartRows(masterItems, deliveryPlans, draftRows) {
  const masterKeys = new Set()
  const rows = []
  for (const m of masterItems.filter((x) => x.status !== 'Inactive')) {
    const k = `${m.modelName}\t${m.partNo}`
    masterKeys.add(k)
    rows.push({
      rowKey: `m:${k}`,
      kind: 'master',
      modelName: m.modelName,
      partNo: m.partNo,
    })
  }
  for (const p of deliveryPlans) {
    if (!p.modelName && !p.partNo) continue
    const k = `${p.modelName}\t${p.partNo}`
    if (masterKeys.has(k)) continue
    masterKeys.add(k)
    rows.push({ rowKey: `p:${k}`, kind: 'plan', modelName: p.modelName, partNo: p.partNo })
  }
  const drafts = draftRows.filter((d) => {
    if (!d.modelName || !d.partNo) return true
    return !masterKeys.has(`${d.modelName}\t${d.partNo}`)
  })
  for (const d of drafts) {
    rows.push({
      rowKey: `d:${d.id}`,
      kind: 'draft',
      draftId: d.id,
      modelName: d.modelName,
      partNo: d.partNo,
    })
  }
  rows.sort((a, b) => {
    const ma = a.modelName || ''
    const mb = b.modelName || ''
    if (ma !== mb) return ma.localeCompare(mb)
    return (a.partNo || '').localeCompare(b.partNo || '')
  })
  return rows
}

function WeekCell({ col, plan, disabled, asOfDate, onQtyChange }) {
  const mon = weekStartFromCol(col)
  const weekRange = getWeekRange(asOfDate)
  const isFutureWeek = mon > weekRange.end
  const lockedByRow = plan?.locked === true
  const lockedByPolicy = FUTURE_WEEKS_LOCKED && isFutureWeek
  const readOnly = disabled || lockedByRow || lockedByPolicy
  const val = plan?.qty ?? ''
  const ariaWeek = `${formatKoEn(L.deliveryPlanWeeklyQty)} · ${col.headerShort}`

  return (
    <td className="dp-week-cell dp-week-col" title={`${col.week} · ${mon}`}>
      <input
        className="dp-input dp-input--qty"
        type="number"
        min={0}
        step={1}
        disabled={readOnly}
        aria-label={ariaWeek}
        value={val === '' ? '' : val}
        onChange={(e) => onQtyChange(col, e.target.value)}
      />
    </td>
  )
}

export default function DeliveryPlanPage({
  masterItems,
  deliveryPlans,
  setDeliveryPlans,
  opsMeta,
}) {
  const asOfDate = opsMeta?.asOfDate ?? operationsMeta.asOfDate
  const [pastWeeks, setPastWeeks] = useState(DEFAULT_PAST)
  const [futureWeeks, setFutureWeeks] = useState(DEFAULT_FUTURE)
  const [weekOffset, setWeekOffset] = useState(0)
  const [draftRows, setDraftRows] = useState([])
  const [saveHint, setSaveHint] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const columns = useMemo(
    () => buildWeekHorizon(asOfDate, pastWeeks, futureWeeks, weekOffset),
    [asOfDate, pastWeeks, futureWeeks, weekOffset],
  )

  const planByKey = useMemo(() => {
    const m = new Map()
    for (const p of deliveryPlans) {
      if (!p.modelName || !p.partNo) continue
      const mon = planWeekMonday(p)
      if (!mon) continue
      m.set(`${p.modelName}\t${p.partNo}\t${mon}`, p)
    }
    return m
  }, [deliveryPlans])

  const partRows = useMemo(
    () => buildPartRows(masterItems, deliveryPlans, draftRows),
    [masterItems, deliveryPlans, draftRows],
  )

  useEffect(() => {
    if (!deleteTarget) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setDeleteTarget(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteTarget])

  const onQtyChange = useCallback(
    (modelName, partNo) => (col, raw) => {
      if (!modelName || !partNo) return
      const wk = weekStartFromCol(col)
      setDeliveryPlans((plans) => mergeCellUpdate(plans, modelName, partNo, wk, raw))
    },
    [setDeliveryPlans],
  )

  function handleSave() {
    saveJson(storageKeys.plans, deliveryPlans)
    setSaveHint('saved')
    setTimeout(() => setSaveHint(''), 2500)
  }

  function addDraftRow() {
    setDraftRows((r) => [...r, { id: newId('draft'), modelName: '', partNo: '' }])
  }

  function updateDraft(draftId, patch) {
    setDraftRows((rows) => rows.map((d) => (d.id === draftId ? { ...d, ...patch } : d)))
  }

  function removeDraft(draftId) {
    setDraftRows((rows) => rows.filter((d) => d.id !== draftId))
  }

  function requestDeleteRow(spec) {
    const { modelName, partNo, kind, draftId } = spec
    if (kind === 'draft' && (!String(modelName || '').trim() || !String(partNo || '').trim())) {
      removeDraft(draftId)
      return
    }
    setDeleteTarget({ modelName, partNo, kind, draftId })
  }

  function confirmDeletePartPlans() {
    if (!deleteTarget) return
    const { modelName, partNo, kind, draftId } = deleteTarget
    setDeliveryPlans((plans) =>
      plans.filter((p) => !(p.modelName === modelName && p.partNo === partNo)),
    )
    if (kind === 'draft' && draftId) removeDraft(draftId)
    setDeleteTarget(null)
  }

  function cancelDeletePartPlans() {
    setDeleteTarget(null)
  }

  const pastOptions = useMemo(
    () => Array.from({ length: MAX_PAST_WEEKS + 1 }, (_, i) => i),
    [],
  )

  return (
    <div className="page delivery-plan-page">
      <header className="page__header">
        <h1>
          <BilingualLabel label={L.deliveryPlanScreenTitle} compact as="span" />
        </h1>
        <p className="page__desc">
          <BilingualLabel label={L.deliveryPlanPageDesc} compact as="span" />
        </p>
        <p className="page__desc page__desc--secondary">
          <BilingualLabel label={L.deliveryPlanScreenSubtitle} compact as="span" />
        </p>
        <div className="delivery-plan-page__toolbar">
          <label>
            <BilingualLabel label={L.previousWeeksShown} compact as="span" />
            <select
              value={pastWeeks}
              onChange={(e) => setPastWeeks(Number(e.target.value))}
              aria-label={formatKoEn(L.previousWeeksShown)}
            >
              {pastOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <BilingualLabel label={L.futureWeeksShown} compact as="span" />
            <select
              value={futureWeeks}
              onChange={(e) => setFutureWeeks(Number(e.target.value))}
              aria-label={formatKoEn(L.futureWeeksShown)}
            >
              <option value={12}>12</option>
              <option value={18}>18</option>
              <option value={22}>22</option>
              <option value={26}>26</option>
              <option value={34}>34</option>
            </select>
          </label>
          <div className="delivery-plan-page__nav">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setWeekOffset((o) => o - 12)}
            >
              {formatKoEn(L.previous12Weeks)}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setWeekOffset((o) => o + 12)}
            >
              {formatKoEn(L.next12Weeks)}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setWeekOffset(0)
                setPastWeeks(DEFAULT_PAST)
                setFutureWeeks(DEFAULT_FUTURE)
              }}
            >
              {formatKoEn(L.currentBaseline)}
            </button>
          </div>
          <span className="page__hint" style={{ margin: 0 }}>
            {formatKoEn(L.asOfDate)}: <strong>{asOfDate}</strong> · {formatKoEn(L.columnsCount)}{' '}
            {columns.length} {formatKoEn(L.weeks)}
            {weekOffset !== 0
              ? ` · ${formatKoEn(L.viewOffsetWeeks)} ${weekOffset > 0 ? '+' : ''}${weekOffset} ${formatKoEn(L.weeks)}`
              : ''}
          </span>
          <div className="page__actions" style={{ marginLeft: 'auto' }}>
            <button type="button" className="btn btn--ghost" onClick={addDraftRow}>
              {formatKoEn(L.addSkuRow)}
            </button>
            <button type="button" className="btn btn--primary" onClick={handleSave}>
              {formatKoEn(L.save)}
            </button>
          </div>
        </div>
        {saveHint && (
          <p className="page__hint" role="status">
            <BilingualLabel label={L.savedToBrowserStorage} compact as="span" />
          </p>
        )}
      </header>

      {deleteTarget && (
        <div
          className="dp-modal-backdrop"
          role="presentation"
          onClick={cancelDeletePartPlans}
        >
          <div
            className="dp-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dp-delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="dp-delete-title" className="dp-modal__title">
              <BilingualLabel label={L.deletePartPlansTitle} compact as="span" />
            </h2>
            <div className="dp-modal__body">
              <p>{L.deletePartPlansConfirm.ko}</p>
              <p className="dp-modal__body-en">{L.deletePartPlansConfirm.en}</p>
            </div>
            <div className="dp-modal__actions">
              <button type="button" className="btn btn--ghost" onClick={cancelDeletePartPlans}>
                {formatKoEn(L.actionCancel)}
              </button>
              <button type="button" className="btn btn--primary dp-btn-delete-confirm" onClick={confirmDeletePartPlans}>
                {formatKoEn(L.actionDelete)}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="dp-table-wrap page__table">
        <table className="dp-grid">
          <thead>
            <tr>
              <th className="dp-th--sticky dp-col-model">
                <BilingualLabel label={L.model} compact as="span" />
              </th>
              <th className="dp-th--sticky-end dp-col-part">
                <BilingualLabel label={L.partNo} compact as="span" />
              </th>
              {columns.map((c) => {
                const wk = weekStartFromCol(c)
                return (
                  <th key={wk} className="dp-week-col" title={`${c.week} · ${wk}`}>
                    {c.headerShort}
                  </th>
                )
              })}
              <th className="dp-th-actions" scope="col" aria-label={formatKoEn(L.actionDelete)}>
                <BilingualLabel label={L.actionDelete} compact as="span" />
              </th>
            </tr>
          </thead>
          <tbody>
            {partRows.map((spec) => {
              const { modelName, partNo, rowKey, kind, draftId } = spec
              const cellDisabled =
                (kind === 'draft' && (!modelName || !partNo)) ||
                (kind === 'plan' && (!modelName || !partNo))
              const masterFrozen = kind === 'master'
              const canQuickRemoveDraft =
                kind === 'draft' && (!String(modelName || '').trim() || !String(partNo || '').trim())
              const showDeleteConfirm =
                kind === 'master' ||
                kind === 'plan' ||
                (kind === 'draft' && !canQuickRemoveDraft)
              const deleteDisabled =
                kind === 'draft' && canQuickRemoveDraft ? false : !modelName || !partNo

              return (
                <tr key={rowKey}>
                  <td className="dp-td--sticky dp-col-model">
                    {masterFrozen ? (
                      <input
                        className="dp-input dp-input--readonly"
                        readOnly
                        tabIndex={-1}
                        value={modelName}
                      />
                    ) : (
                      <input
                        className="dp-input"
                        value={modelName}
                        placeholder={formatKoEn(L.model)}
                        onChange={(e) => {
                          if (kind === 'draft') updateDraft(draftId, { modelName: e.target.value })
                          else
                            setDeliveryPlans((plans) =>
                              plans.map((p) =>
                                `${p.modelName}\t${p.partNo}` === `${modelName}\t${partNo}`
                                  ? { ...p, modelName: e.target.value }
                                  : p,
                              ),
                            )
                        }}
                      />
                    )}
                  </td>
                  <td className="dp-td--sticky-end dp-col-part">
                    {masterFrozen ? (
                      <input
                        className="dp-input dp-input--readonly"
                        readOnly
                        tabIndex={-1}
                        value={partNo}
                      />
                    ) : kind === 'draft' ? (
                      <input
                        className="dp-input"
                        value={partNo}
                        placeholder={formatKoEn(L.partNo)}
                        onChange={(e) => updateDraft(draftId, { partNo: e.target.value })}
                      />
                    ) : (
                      <input
                        className="dp-input"
                        value={partNo}
                        placeholder={formatKoEn(L.partNo)}
                        onChange={(e) => {
                          setDeliveryPlans((plans) =>
                            plans.map((p) =>
                              `${p.modelName}\t${p.partNo}` === `${modelName}\t${partNo}`
                                ? { ...p, partNo: e.target.value }
                                : p,
                            ),
                          )
                        }}
                      />
                    )}
                  </td>
                  {columns.map((col) => {
                    const wk = weekStartFromCol(col)
                    const plan = planByKey.get(`${modelName}\t${partNo}\t${wk}`)
                    return (
                      <WeekCell
                        key={wk}
                        col={col}
                        plan={plan}
                        asOfDate={asOfDate}
                        disabled={cellDisabled}
                        onQtyChange={onQtyChange(modelName, partNo)}
                      />
                    )
                  })}
                  <td className="dp-td-actions">
                    <button
                      type="button"
                      className="btn btn--ghost dp-btn-delete-row"
                      disabled={deleteDisabled}
                      title={formatKoEn(L.actionDelete)}
                      aria-label={formatKoEn(L.actionDelete)}
                      onClick={() => {
                        if (deleteDisabled) return
                        if (showDeleteConfirm) requestDeleteRow(spec)
                        else removeDraft(draftId)
                      }}
                    >
                      {formatKoEn(L.actionDelete)}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
