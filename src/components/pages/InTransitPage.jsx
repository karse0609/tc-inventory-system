import { useState } from 'react'
import { saveJson, storageKeys } from '../../utils/appPersistence'
import { newId } from '../../utils/newId'
import '../logistics/ops.css'
import './pages.css'

function emptyRow() {
  return {
    id: newId('tr'),
    containerNo: '',
    modelName: '',
    partNo: '',
    qty: 0,
    etdTcTech: '',
    etdPort: '',
    etaPort: '',
    status: 'In Transit',
    delayed: false,
    delayReason: '',
  }
}

export default function InTransitPage({ inTransit, setInTransit }) {
  const [saveHint, setSaveHint] = useState('')

  function flashSaved() {
    setSaveHint('Saved to browser storage')
    setTimeout(() => setSaveHint(''), 2500)
  }

  function handleSave() {
    saveJson(storageKeys.transit, inTransit)
    flashSaved()
  }
  function updateRow(id, patch) {
    setInTransit((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function handleAdd() {
    setInTransit((rows) => [...rows, emptyRow()])
  }

  function handleDelete(id) {
    setInTransit((rows) => rows.filter((r) => r.id !== id))
  }

  return (
    <div className="page page--wide">
      <header className="page__header">
        <h1>In-Transit</h1>
        <p className="page__desc">해상/항만 운송 중 컨테이너 라인을 편집합니다.</p>
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
              <th>Container</th>
              <th>Model</th>
              <th>Part No</th>
              <th>Qty</th>
              <th>ETD TC</th>
              <th>ETD Port</th>
              <th>ETA Port</th>
              <th>Status</th>
              <th>Delayed</th>
              <th>Delay reason</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {inTransit.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    className="cell-input"
                    value={row.containerNo}
                    onChange={(e) => updateRow(row.id, { containerNo: e.target.value })}
                  />
                </td>
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
                    className="cell-input cell-input--num"
                    type="number"
                    value={row.qty}
                    onChange={(e) => updateRow(row.id, { qty: Number(e.target.value) || 0 })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    type="date"
                    value={row.etdTcTech || ''}
                    onChange={(e) => updateRow(row.id, { etdTcTech: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    type="date"
                    value={row.etdPort || ''}
                    onChange={(e) => updateRow(row.id, { etdPort: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    type="date"
                    value={row.etaPort || ''}
                    onChange={(e) => updateRow(row.id, { etaPort: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    value={row.status}
                    onChange={(e) => updateRow(row.id, { status: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={!!row.delayed}
                    onChange={(e) => updateRow(row.id, { delayed: e.target.checked })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    value={row.delayReason ?? ''}
                    onChange={(e) => updateRow(row.id, { delayReason: e.target.value })}
                  />
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
