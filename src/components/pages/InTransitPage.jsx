import { useState } from 'react'
import { L } from '../../i18n/labels'
import { saveJson, storageKeys } from '../../utils/appPersistence'
import { newId } from '../../utils/newId'
import {
  parseShipmentScheduleExcel,
  ParseShipmentScheduleError,
} from '../../utils/parseShipmentScheduleExcel'
import '../logistics/ops.css'
import './pages.css'
import './InTransitPage.css'

/** 한글(English) 단일 라인 라벨 */
function koEn(label) {
  if (!label?.ko) return ''
  return label.en ? `${label.ko}(${label.en})` : label.ko
}

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
    tcTechNo: '',
  }
}

export default function InTransitPage({ inTransit, setInTransit, setMasterItems }) {
  const [saveHint, setSaveHint] = useState('')
  const [uploadError, setUploadError] = useState('')

  function flashSaved() {
    setSaveHint('브라우저 저장소에 반영됨(Saved to browser storage)')
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
      setSaveHint(
        `“${sheetName}” 시트에서 ${rows.length}행 로드됨(Loaded ${rows.length} row(s))`,
      )
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
    <div className="page page--transit-compact">
      <header className="page__header">
        <div className="page__header--row">
          <div>
            <h1>{koEn({ ko: '운송중', en: 'In-Transit' })}</h1>
            <p className="page__desc">
              선적·항만 운송 라인 편집. Excel 시트 <strong>ML and Redmond</strong> 업로드로
              일괄 반영(Edit lines · bulk import via Shipment Schedule).
            </p>
          </div>
          <div className="page__actions">
            <label className="btn btn--ghost" style={{ cursor: 'pointer' }}>
              {koEn({ ko: '선적 일정 업로드', en: 'Shipment upload' })}
              <input
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleShipmentFile}
              />
            </label>
            <button type="button" className="btn btn--ghost" onClick={handleAdd}>
              {koEn({ ko: '행 추가', en: 'Add row' })}
            </button>
            <button type="button" className="btn btn--primary" onClick={handleSave}>
              {koEn({ ko: '저장', en: 'Save' })}
            </button>
          </div>
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

      <div className="transit-page__table-wrap page__table">
        <table className="transit-page__table">
          <colgroup>
            <col className="transit-page__col--container" />
            <col className="transit-page__col--model" />
            <col className="transit-page__col--part" />
            <col className="transit-page__col--qty" />
            <col className="transit-page__col--date" />
            <col className="transit-page__col--date" />
            <col className="transit-page__col--date" />
            <col className="transit-page__col--eta-wh" />
            <col className="transit-page__col--delivery" />
            <col className="transit-page__col--arrived" />
            <col className="transit-page__col--remark" />
            <col className="transit-page__col--tctech" />
            <col className="transit-page__col--actions" />
          </colgroup>
          <thead>
            <tr>
              <th>{koEn(L.containerNo)}</th>
              <th>{koEn(L.model)}</th>
              <th>{koEn(L.partNo)}</th>
              <th>{koEn(L.qty)}</th>
              <th className="transit-page__th--en">ETD TC TECH</th>
              <th className="transit-page__th--en">ETD Port</th>
              <th className="transit-page__th--en">ETA Port</th>
              <th className="transit-page__th--en">ETA W/H</th>
              <th>{koEn(L.deliveryLocation)}</th>
              <th>{koEn(L.arrived)}</th>
              <th>{koEn(L.remark)}</th>
              <th className="transit-page__th--en">TC TECH No.</th>
              <th>{koEn({ ko: '작업', en: 'Act' })}</th>
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
                    className="cell-input cell-input--date"
                    type="date"
                    value={row.etdTcTech || ''}
                    onChange={(e) => updateRow(row.id, { etdTcTech: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input cell-input--date"
                    type="date"
                    value={row.etdPort || ''}
                    onChange={(e) => updateRow(row.id, { etdPort: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input cell-input--date"
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
                    title="입고 완료 후 저장 시 Master 재고 반영·행 제거"
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
                    value={row.tcTechNo ?? ''}
                    onChange={(e) => updateRow(row.id, { tcTechNo: e.target.value })}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn--ghost transit-page__btn-del"
                    onClick={() => handleDelete(row.id)}
                  >
                    {koEn({ ko: '삭제', en: 'Del' })}
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
