import { useCallback, useMemo, useState } from 'react'
import { operationsMeta } from '../../data/logisticsSampleData'
import { saveJson, storageKeys } from '../../utils/appPersistence'
import {
  buildWeekHorizon,
  planWeekMonday,
} from '../../utils/deliveryPlanHorizon'
import { newId } from '../../utils/newId'
import '../logistics/ops.css'
import './pages.css'
import './DeliveryPlanPage.css'

const DEFAULT_PAST = 2
const DEFAULT_FUTURE = 22

function mergeCellUpdate(plans, modelName, partNo, colMonday, meta, patch) {
  const idx = plans.findIndex(
    (p) =>
      p.modelName === modelName &&
      p.partNo === partNo &&
      planWeekMonday(p) === colMonday,
  )
  const prev = idx >= 0 ? plans[idx] : {}

  const planned =
    patch.plannedQty !== undefined
      ? patch.plannedQty === '' || patch.plannedQty === null
        ? 0
        : Number(patch.plannedQty) || 0
      : Number(prev.plannedQty) || 0

  let confirmed =
    patch.confirmedQty !== undefined
      ? patch.confirmedQty === '' || patch.confirmedQty === null
        ? null
        : Number(patch.confirmedQty)
      : prev.confirmedQty ?? null
  if (typeof confirmed === 'number' && Number.isNaN(confirmed)) confirmed = null

  const plannedEmpty = planned === 0
  const confEmpty = confirmed === null || confirmed === undefined

  if (plannedEmpty && confEmpty && idx >= 0) {
    return plans.filter((_, i) => i !== idx)
  }
  if (plannedEmpty && confEmpty) return plans

  const row = {
    id: idx >= 0 ? prev.id : newId('plan'),
    modelName,
    partNo,
    periodStart: colMonday,
    week: meta.week,
    label: meta.label,
    plannedQty: planned,
    confirmedQty: confEmpty ? null : confirmed,
    status: prev.status ?? 'planned',
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

function WeekCell({ col, plan, disabled, onPatch }) {
  const pVal = plan?.plannedQty ?? ''
  const cVal = plan?.confirmedQty ?? ''
  return (
    <td className="dp-week-cell dp-week-col" title={col.week}>
      <div className="dp-week-cell__stack">
        <input
          className="dp-input dp-input--planned"
          type="number"
          min={0}
          step={1}
          disabled={disabled}
          aria-label={`Planned ${col.headerShort}`}
          value={pVal === '' ? '' : pVal}
          onChange={(e) =>
            onPatch(col, { plannedQty: e.target.value, confirmedQty: plan?.confirmedQty })
          }
        />
        <input
          className="dp-input dp-input--confirmed"
          type="number"
          min={0}
          step={1}
          disabled={disabled}
          aria-label={`Confirmed ${col.headerShort}`}
          value={cVal === '' || cVal == null ? '' : cVal}
          placeholder="Cfm"
          onChange={(e) =>
            onPatch(col, { plannedQty: plan?.plannedQty ?? 0, confirmedQty: e.target.value })
          }
        />
      </div>
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
  const [draftRows, setDraftRows] = useState([])
  const [saveHint, setSaveHint] = useState('')

  const columns = useMemo(
    () => buildWeekHorizon(asOfDate, pastWeeks, futureWeeks),
    [asOfDate, pastWeeks, futureWeeks],
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

  const onPatch = useCallback(
    (modelName, partNo) => (col, patch) => {
      if (!modelName || !partNo) return
      setDeliveryPlans((plans) =>
        mergeCellUpdate(plans, modelName, partNo, col.periodStart, col, patch),
      )
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

  return (
    <div className="page delivery-plan-page">
      <header className="page__header">
        <h1>Delivery Plan</h1>
        <p className="page__desc">
          품번(행) × 주차(열) 가로형 그리드. Planned(위) / Confirmed(아래·청록) · 주차는 기준일 기준
          자동 생성. Forecast Upload와 동일 Master Part만 집계됩니다.
        </p>
        <div className="delivery-plan-page__toolbar">
          <label>
            이전 주
            <select
              value={pastWeeks}
              onChange={(e) => setPastWeeks(Number(e.target.value))}
            >
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={4}>4</option>
            </select>
          </label>
          <label>
            이후 주
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
          <span className="page__hint" style={{ margin: 0 }}>
            기준일: <strong>{asOfDate}</strong> · 열 {columns.length}주
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
              {columns.map((c) => (
                <th key={c.periodStart} className="dp-week-col" title={`${c.week} · ${c.periodStart}`}>
                  {c.headerShort}
                </th>
              ))}
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
                    const plan = planByKey.get(`${modelName}\t${partNo}\t${col.periodStart}`)
                    return (
                      <WeekCell
                        key={col.periodStart}
                        col={col}
                        plan={plan}
                        disabled={cellDisabled}
                        onPatch={onPatch(modelName, partNo)}
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
