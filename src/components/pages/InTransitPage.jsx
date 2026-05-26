import { useState } from 'react'
import BilingualLabel from '../BilingualLabel'
import { L } from '../../i18n/labels'
import { saveJson, storageKeys } from '../../utils/appPersistence'
import { newId } from '../../utils/newId'
import {
  parseShipmentScheduleExcel,
  ParseShipmentScheduleError,
} from '../../utils/parseShipmentScheduleExcel'
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
    etaWh: '',
    deliveryLocation: '',
    remark: '',
    arrived: false,
    forwarder: '',
    hbl: '',
    tcTechNo: '',
  }
}

export default function InTransitPage({ inTransit, setInTransit, setMasterItems }) {
  const [saveHint, setSaveHint] = useState('')
  const [uploadError, setUploadError] = useState('')

  function flashSaved() {
    setSaveHint('Saved to browser storage')
    setTimeout(() => setSaveHint(''), 2500)
  }

  function handleSave() {
    const arrivedRows = inTransit.filter((r) => r.arrived)
    const rest = inTransit.filter((r) => !r.arrived)

    if (arrivedRows.length) {
      setMasterItems((master) => {
        const next = master.map((m) => ({ ...m }))
        for (const r of arrivedRows) {
          const qty = Number(r.qty) || 0
          if (qty <= 0) continue
          const ix = next.findIndex(
            (x) => x.partNo === r.partNo && x.modelName === r.modelName,
          )
          if (ix >= 0) {
            next[ix] = {
              ...next[ix],
              currentStock: (Number(next[ix].currentStock) || 0) + qty,
            }
          }
        }
        return next
      })
    }

    setInTransit(rest)
    saveJson(storageKeys.transit, rest)
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

  async function handleShipmentFile(ev) {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return
    setUploadError('')
    try {
      const buffer = await file.arrayBuffer()
      const { rows, sheetName } = parseShipmentScheduleExcel(buffer)
      setInTransit((prev) => [...prev, ...rows])
      setSaveHint(`Loaded ${rows.length} row(s) from “${sheetName}”`)
      setTimeout(() => setSaveHint(''), 4000)
    } catch (err) {
      setUploadError(
        err instanceof ParseShipmentScheduleError
          ? err.message
          : '업로드 처리 중 오류가 발생했습니다.',
      )
    }
  }

  return (
    <div className="page page--wide">
      <header className="page__header">
        <h1>In-Transit</h1>
        <p className="page__desc">
          해상/항만 운송 중 컨테이너 라인을 편집합니다. Shipment Schedule Excel 시트{' '}
          <strong>ML and Redmond</strong>를 업로드해 일괄 반영할 수 있습니다.
        </p>
        <div className="page__actions">
          <label className="btn btn--ghost" style={{ cursor: 'pointer' }}>
            Shipment Schedule Upload
            <input
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleShipmentFile}
            />
          </label>
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
        {uploadError && (
          <p className="page__hint page__hint--error" role="alert">
            {uploadError}
          </p>
        )}
      </header>

      <div className="table-wrap page__table">
        <table className="ops-table ops-table--transit">
          <thead>
            <tr>
              <th>
                <BilingualLabel label={L.containerNo} />
              </th>
              <th>
                <BilingualLabel label={L.model} />
              </th>
              <th>
                <BilingualLabel label={L.partNo} />
              </th>
              <th>
                <BilingualLabel label={L.qty} />
              </th>
              <th>
                <BilingualLabel label={L.etdTcTech} />
              </th>
              <th>
                <BilingualLabel label={L.etdPort} />
              </th>
              <th>
                <BilingualLabel label={L.etaPort} />
              </th>
              <th>
                <BilingualLabel label={L.etaWh} />
              </th>
              <th>
                <BilingualLabel label={L.deliveryLocation} />
              </th>
              <th>
                <BilingualLabel label={L.arrived} />
              </th>
              <th>
                <BilingualLabel label={L.remark} />
              </th>
              <th>
                <BilingualLabel label={L.forwarder} />
              </th>
              <th>
                <BilingualLabel label={L.hbl} />
              </th>
              <th>
                <BilingualLabel label={L.tcTechNo} />
              </th>
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
                    value={row.etaWh ?? ''}
                    onChange={(e) => updateRow(row.id, { etaWh: e.target.value })}
                    placeholder="YYYY-MM-DD"
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    value={row.deliveryLocation ?? ''}
                    onChange={(e) =>
                      updateRow(row.id, { deliveryLocation: e.target.value })
                    }
                  />
                </td>
                <td className="cell--center">
                  <input
                    type="checkbox"
                    checked={!!row.arrived}
                    onChange={(e) => updateRow(row.id, { arrived: e.target.checked })}
                    title="입고 완료 시 체크 후 Save — Master 재고 반영 후 목록에서 제거"
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    value={row.remark ?? ''}
                    onChange={(e) => updateRow(row.id, { remark: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    value={row.forwarder ?? ''}
                    onChange={(e) => updateRow(row.id, { forwarder: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    value={row.hbl ?? ''}
                    onChange={(e) => updateRow(row.id, { hbl: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    value={row.tcTechNo ?? ''}
                    onChange={(e) => updateRow(row.id, { tcTechNo: e.target.value })}
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
