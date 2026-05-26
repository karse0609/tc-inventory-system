import { useCallback, useMemo, useState } from 'react'
import { operationsMeta } from '../../data/logisticsSampleData'
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

  return (
    <td className="dp-week-cell dp-week-col" title={`${col.week} · ${mon}`}>
      <input
        className="dp-input dp-input--qty"
        type="number"
        min={0}
        step={1}
        disabled={readOnly}
        aria-label={`Weekly qty ${col.headerShort}`}
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
    setSaveHint('Saved to browser storage')
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

  const pastOptions = useMemo(
    () => Array.from({ length: MAX_PAST_WEEKS + 1 }, (_, i) => i),
    [],
  )

  return (
    <div className="page delivery-plan-page">
      <header className="page__header">
        <h1>Delivery Plan</h1>
        <p className="page__desc">
          품번(행) × 주차(열) 가로형 그리드. 주 셀에는 주간 납품 수량(qty)만 입력합니다. 기준일 주간을
          포함해 과거는 최대 52주까지 넓혀 조회할 수 있으며, 데이터는 브라우저 저장소에 유지됩니다.
          Inventory Projection의 Weekly Delivery은 이 수량을 사용합니다.
        </p>
        <div className="delivery-plan-page__toolbar">
          <label>
            이전 주(표시)
            <select
              value={pastWeeks}
              onChange={(e) => setPastWeeks(Number(e.target.value))}
            >
              {pastOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            이후 주(표시)
            <select
              value={futureWeeks}
              onChange={(e) => setFutureWeeks(Number(e.target.value))}
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
              이전 12주
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setWeekOffset((o) => o + 12)}
            >
              다음 12주
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
              현재 기준으로
            </button>
          </div>
          <span className="page__hint" style={{ margin: 0 }}>
            기준일: <strong>{asOfDate}</strong> · 열 {columns.length}주
            {weekOffset !== 0 ? ` · 뷰 오프셋 ${weekOffset > 0 ? '+' : ''}${weekOffset}주` : ''}
          </span>
          <div className="page__actions" style={{ marginLeft: 'auto' }}>
            <button type="button" className="btn btn--ghost" onClick={addDraftRow}>
              Add SKU row
            </button>
            <button type="button" className="btn btn--primary" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
        {saveHint && (
          <p className="page__hint" role="status">
            {saveHint}
          </p>
        )}
      </header>

      <div className="dp-table-wrap page__table">
        <table className="dp-grid">
          <thead>
            <tr>
              <th className="dp-th--sticky dp-col-model">Model</th>
              <th className="dp-th--sticky-end dp-col-part">Part No</th>
              {columns.map((c) => {
                const wk = weekStartFromCol(c)
                return (
                  <th key={wk} className="dp-week-col" title={`${c.week} · ${wk}`}>
                    {c.headerShort}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {partRows.map((spec) => {
              const { modelName, partNo, rowKey, kind, draftId } = spec
              const cellDisabled =
                (kind === 'draft' && (!modelName || !partNo)) ||
                (kind === 'plan' && (!modelName || !partNo))
              const masterFrozen = kind === 'master'
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
                        placeholder="Model"
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
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        <input
                          className="dp-input"
                          style={{ flex: 1 }}
                          value={partNo}
                          placeholder="Part No"
                          onChange={(e) => updateDraft(draftId, { partNo: e.target.value })}
                        />
                        <button
                          type="button"
                          className="btn btn--ghost dp-actions"
                          title="Remove row"
                          onClick={() => removeDraft(draftId)}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <input
                        className="dp-input"
                        value={partNo}
                        placeholder="Part No"
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
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
