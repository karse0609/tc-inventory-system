import { useState } from 'react'
import { saveJson, storageKeys } from '../../utils/appPersistence'
import { newId } from '../../utils/newId'
import '../logistics/ops.css'
import './pages.css'

function emptyPlan() {
  return {
    id: newId('plan'),
    modelName: '',
    partNo: '',
    week: '',
    label: '',
    periodStart: '',
    plannedQty: 0,
    confirmedQty: null,
    status: 'planned',
  }
}

export default function DeliveryPlanPage({
  masterItems,
  deliveryPlans,
  setDeliveryPlans,
}) {
  const [saveHint, setSaveHint] = useState('')
  const partOptions = masterItems.filter((m) => m.status !== 'Inactive')

  function flashSaved() {
    setSaveHint('Saved to browser storage')
    setTimeout(() => setSaveHint(''), 2500)
  }

  function handleSave() {
    saveJson(storageKeys.plans, deliveryPlans)
    flashSaved()
  }

  function updateRow(id, patch) {
    setDeliveryPlans((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function handleAdd() {
    setDeliveryPlans((rows) => [...rows, emptyPlan()])
  }

  function handleDelete(id) {
    setDeliveryPlans((rows) => rows.filter((r) => r.id !== id))
  }

  function fillFromMaster(id, modelName, partNo) {
    updateRow(id, { modelName, partNo })
  }

  return (
    <div className="page page--wide">
      <header className="page__header">
        <h1>Delivery Plan</h1>
        <p className="page__desc">
          주차별 납품 계획(Planned / Confirmed)을 관리합니다. Forecast Upload는 Master에 등록된 Part
          No와만 매칭해 수량을 갱신합니다.
        </p>
        <div className="page__actions">
          <button type="button" className="btn btn--ghost" onClick={handleAdd}>
            Add Row
          </button>
          <button type="button" className="btn btn--primary" onClick={handleSave}>
            Save
          </button>
        </div>
        {saveHint && (
          <p className="page__hint" role="status">
            {saveHint}
          </p>
        )}
      </header>

      <div className="table-wrap page__table">
        <table className="ops-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Part No</th>
              <th>Week</th>
              <th>Period Start</th>
              <th>Planned Qty</th>
              <th>Confirmed Qty</th>
              <th>Status</th>
              <th>Quick pick</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {deliveryPlans.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    className="cell-input"
                    value={row.modelName}
                    onChange={(e) => updateRow(row.id, { modelName: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    value={row.partNo}
                    onChange={(e) => updateRow(row.id, { partNo: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    value={row.week}
                    placeholder="2026-W22"
                    onChange={(e) => updateRow(row.id, { week: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    type="date"
                    value={row.periodStart || ''}
                    onChange={(e) => updateRow(row.id, { periodStart: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input cell-input--num"
                    type="number"
                    value={row.plannedQty}
                    onChange={(e) =>
                      updateRow(row.id, { plannedQty: Number(e.target.value) || 0 })
                    }
                  />
                </td>
                <td>
                  <input
                    className="cell-input cell-input--num"
                    type="number"
                    value={row.confirmedQty ?? ''}
                    placeholder="—"
                    onChange={(e) => {
                      const v = e.target.value
                      updateRow(row.id, {
                        confirmedQty: v === '' ? null : Number(v),
                      })
                    }}
                  />
                </td>
                <td>
                  <select
                    className="cell-input"
                    value={row.status ?? 'planned'}
                    onChange={(e) => updateRow(row.id, { status: e.target.value })}
                  >
                    <option value="planned">planned</option>
                    <option value="in_progress">in_progress</option>
                    <option value="completed">completed</option>
                  </select>
                </td>
                <td>
                  <select
                    className="cell-input"
                    defaultValue=""
                    onChange={(e) => {
                      const v = e.target.value
                      if (!v) return
                      const [modelName, partNo] = v.split('||')
                      fillFromMaster(row.id, modelName, partNo)
                    }}
                  >
                    <option value="">From master…</option>
                    {partOptions.map((m) => (
                      <option key={m.id} value={`${m.modelName}||${m.partNo}`}>
                        {m.modelName} · {m.partNo}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => handleDelete(row.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
