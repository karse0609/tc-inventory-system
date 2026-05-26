import { useCallback, useRef, useState } from 'react'
import { operationsMeta } from '../../data/logisticsSampleData'
import { L, formatKoEn } from '../../i18n/labels'
import { saveJson, storageKeys } from '../../utils/appPersistence'
import {
  matrixToTsv,
  parseBoolCell,
  parseDateForInput,
  parseQtyCell,
  readClipboardText,
  splitTsvToMatrix,
  writeClipboardText,
} from '../../utils/excelGridClipboard'
import { resolveReceiptDateForLedger } from '../../utils/inventoryAsOf'
import { isInTransitRowDelayed } from '../../utils/logisticsMetrics'
import { newId } from '../../utils/newId'
import { getKoreaCalendarDate } from '../../utils/timeZones'
import {
  parseShipmentScheduleExcel,
  ParseShipmentScheduleError,
} from '../../utils/parseShipmentScheduleExcel'
import ExcelGridToolbar from '../grid/ExcelGridToolbar.jsx'
import useGridNativePaste from '../../hooks/useGridNativePaste.js'
import '../logistics/ops.css'
import './pages.css'
import './InTransitPage.css'

/** 한글(English) 단일 라인 라벨 */
function koEn(label) {
  if (!label?.ko) return ''
  return label.en ? `${label.ko}(${label.en})` : label.ko
}

const TRANSIT_FIELDS = [
  'etaWh',
  'containerNo',
  'modelName',
  'partNo',
  'qty',
  'etdTcTech',
  'etdPort',
  'etaPort',
  'deliveryLocation',
  'arrived',
  'remark',
  'tcTechNo',
]

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

export default function InTransitPage({
  inTransit,
  setInTransit,
  setMasterItems,
  opsMeta,
  appendArrivalLedger,
}) {
  const asOfDate = opsMeta?.asOfDate ?? operationsMeta.asOfDate
  const [saveHint, setSaveHint] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [excelMsg, setExcelMsg] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [invalidIds, setInvalidIds] = useState(() => new Set())
  const transitTableRef = useRef(null)

  function flashSaved() {
    setSaveHint(formatKoEn(L.savedToBrowserStorage))
    setTimeout(() => setSaveHint(''), 2500)
  }

  function handleSave() {
    const arrivedRows = inTransit.filter((r) => r.arrived)
    const rest = inTransit.filter((r) => !r.arrived)

    if (arrivedRows.length && typeof appendArrivalLedger === 'function') {
      const koreaDay = getKoreaCalendarDate()
      const entries = arrivedRows
        .map((r) => ({
          id: newId('arr'),
          modelName: r.modelName,
          partNo: r.partNo,
          qty: Math.max(0, Number(r.qty) || 0),
          receivedAt: resolveReceiptDateForLedger(r, koreaDay),
        }))
        .filter((e) => e.qty > 0 && String(e.modelName).trim() && String(e.partNo).trim())
      if (entries.length) appendArrivalLedger(entries)
    }

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

  function requestDeleteRow(id) {
    if (!window.confirm(L.inTransitDeleteConfirm.ko)) return
    setInTransit((rows) => rows.filter((r) => r.id !== id))
    setSelected((s) => {
      const n = new Set(s)
      n.delete(id)
      return n
    })
  }

  const toggleSelect = useCallback((id) => {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelected((s) => {
      if (s.size === inTransit.length) return new Set()
      return new Set(inTransit.map((r) => r.id))
    })
  }, [inTransit])

  const getPasteStartRowIndex = useCallback(() => {
    if (!selected.size) return 0
    const ix = inTransit.findIndex((r) => selected.has(r.id))
    return ix >= 0 ? ix : 0
  }, [inTransit, selected])

  const applyTransitMatrix = useCallback((matrix, startRow, startCol = 0) => {
    setExcelMsg('')
    setInvalidIds(new Set())
    const errs = []
    const bad = new Set()

    setInTransit((prev) => {
      const next = [...prev]
      for (let r = 0; r < matrix.length; r++) {
        let rowIdx = startRow + r
        while (rowIdx >= next.length) {
          next.push(emptyRow())
        }
        const row = { ...next[rowIdx] }
        for (let mc = 0; mc < matrix[r].length; mc++) {
          const fi = startCol + mc
          if (fi >= TRANSIT_FIELDS.length) break
          const field = TRANSIT_FIELDS[fi]
          const raw = matrix[r][mc]
          const cell = String(raw ?? '').trim()
          if (cell === '') continue
          if (field === 'qty') {
            const p = parseQtyCell(cell)
            if (!p.ok) {
              errs.push(`R${r + 1} C${mc + 1}: qty invalid`)
              bad.add(row.id)
              continue
            }
            row.qty = Math.max(0, p.value)
          } else if (field === 'arrived') {
            row.arrived = parseBoolCell(cell)
          } else if (field === 'etdTcTech' || field === 'etdPort' || field === 'etaPort') {
            const iso = parseDateForInput(cell)
            if (!iso) {
              errs.push(`R${r + 1} C${mc + 1}: ${field} date`)
              bad.add(row.id)
              continue
            }
            row[field] = iso
          } else if (field === 'etaWh') {
            const iso = parseDateForInput(cell)
            row[field] = iso || cell
          } else {
            row[field] = cell
          }
        }
        if (!String(row.modelName).trim() || !String(row.partNo).trim()) {
          errs.push(`Row ${rowIdx + 1}: Model / Part No required`)
          bad.add(row.id)
        }
        next[rowIdx] = row
      }
      return next
    })

    setInvalidIds(bad)
    setExcelMsg(errs.length ? `!${errs.join('\n')}` : formatKoEn(L.excelPasteDone))
  }, [])

  const handlePasteFromExcel = useCallback(async () => {
    setExcelMsg('')
    setInvalidIds(new Set())
    const text = await readClipboardText()
    if (!String(text).trim()) {
      setExcelMsg(`!${formatKoEn(L.excelClipboardEmpty)}`)
      return
    }
    const matrix = splitTsvToMatrix(text)
    if (!matrix.length) {
      setExcelMsg(`!${formatKoEn(L.excelClipboardEmpty)}`)
      return
    }
    applyTransitMatrix(matrix, getPasteStartRowIndex(), 0)
  }, [applyTransitMatrix, getPasteStartRowIndex])

  const onTransitNativePaste = useCallback(
    (matrix, cell) => {
      const row = Number.parseInt(String(cell.getAttribute('data-excel-row') ?? ''), 10)
      const col = Number.parseInt(String(cell.getAttribute('data-excel-col') ?? ''), 10)
      applyTransitMatrix(
        matrix,
        Number.isFinite(row) ? row : 0,
        Number.isFinite(col) ? col : 0,
      )
    },
    [applyTransitMatrix],
  )

  useGridNativePaste({ tableRef: transitTableRef, onPasteMatrix: onTransitNativePaste })

  const handleCopyToExcel = useCallback(async () => {
    setExcelMsg('')
    const header = [
      'ETA W/H',
      'Container',
      'Model',
      'Part No',
      'Qty',
      'ETD TC TECH',
      'ETD Port',
      'ETA Port',
      'Delivery',
      'Arrived',
      'Remark',
      'TC TECH No.',
    ]
    const rowsSrc = selected.size > 0 ? inTransit.filter((r) => selected.has(r.id)) : inTransit
    const body = rowsSrc.map((row) => [
      row.etaWh ?? '',
      row.containerNo ?? '',
      row.modelName ?? '',
      row.partNo ?? '',
      String(row.qty ?? ''),
      row.etdTcTech ?? '',
      row.etdPort ?? '',
      row.etaPort ?? '',
      row.deliveryLocation ?? '',
      row.arrived ? 'TRUE' : 'FALSE',
      row.remark ?? '',
      row.tcTechNo ?? '',
    ])
    await writeClipboardText(matrixToTsv([header, ...body]))
    setExcelMsg(formatKoEn(L.excelCopyDone))
  }, [inTransit, selected])

  const handleClearSelected = useCallback(() => {
    if (!selected.size) return
    setInTransit((rows) => rows.filter((r) => !selected.has(r.id)))
    setSelected(new Set())
    setInvalidIds(new Set())
    setExcelMsg('')
  }, [selected])

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
            <h1>{koEn(L.inTransitInventoryScreen)}</h1>
            <p className="page__desc">
              <span className="page__desc-line">{koEn(L.inTransitSubtitle)}</span>{' '}
              <span className="page__desc-line">
                ETA 지연 행은 강조됩니다. Excel 시트 <strong>ML and Redmond</strong> 업로드로 일괄
                반영할 수 있습니다.
              </span>
            </p>
            <ExcelGridToolbar
              onPasteFromExcel={handlePasteFromExcel}
              onCopyToExcel={handleCopyToExcel}
              onClearSelected={handleClearSelected}
              selectedCount={selected.size}
              message={excelMsg}
            />
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
        <table ref={transitTableRef} className="transit-page__table">
          <colgroup>
            <col style={{ width: '2rem' }} />
            <col className="transit-page__col--eta-wh" />
            <col className="transit-page__col--container" />
            <col className="transit-page__col--model" />
            <col className="transit-page__col--part" />
            <col className="transit-page__col--qty" />
            <col className="transit-page__col--date" />
            <col className="transit-page__col--date" />
            <col className="transit-page__col--date" />
            <col className="transit-page__col--delivery" />
            <col className="transit-page__col--arrived" />
            <col className="transit-page__col--remark" />
            <col className="transit-page__col--tctech" />
            <col className="transit-page__col--actions" />
          </colgroup>
          <thead>
            <tr>
              <th className="cell--center">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={inTransit.length > 0 && selected.size === inTransit.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="transit-page__th--en">ETA W/H</th>
              <th>{koEn(L.containerNo)}</th>
              <th>{koEn(L.model)}</th>
              <th>{koEn(L.partNo)}</th>
              <th>{koEn(L.qty)}</th>
              <th className="transit-page__th--en">ETD TC TECH</th>
              <th className="transit-page__th--en">ETD Port</th>
              <th className="transit-page__th--en">ETA Port</th>
              <th>{koEn(L.deliveryLocation)}</th>
              <th>{koEn(L.arrived)}</th>
              <th>{koEn(L.remark)}</th>
              <th className="transit-page__th--en">TC TECH No.</th>
              <th>{koEn({ ko: '작업', en: 'Act' })}</th>
            </tr>
          </thead>
          <tbody>
            {inTransit.map((row, rowIdx) => (
              <tr
                key={row.id}
                className={
                  (isInTransitRowDelayed(row, asOfDate) ? 'row--delay ' : '') +
                  (invalidIds.has(row.id) ? 'row--excel-invalid' : '')
                }
              >
                <td className="cell--center">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleSelect(row.id)}
                    aria-label="Select row"
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    data-excel-paste
                    data-excel-row={rowIdx}
                    data-excel-col={0}
                    value={row.etaWh ?? ''}
                    onChange={(e) => updateRow(row.id, { etaWh: e.target.value })}
                    placeholder="YYYY-MM-DD"
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    data-excel-paste
                    data-excel-row={rowIdx}
                    data-excel-col={1}
                    value={row.containerNo}
                    onChange={(e) => updateRow(row.id, { containerNo: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    data-excel-paste
                    data-excel-row={rowIdx}
                    data-excel-col={2}
                    value={row.modelName}
                    onChange={(e) => updateRow(row.id, { modelName: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    data-excel-paste
                    data-excel-row={rowIdx}
                    data-excel-col={3}
                    value={row.partNo}
                    onChange={(e) => updateRow(row.id, { partNo: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input cell-input--num"
                    data-excel-paste
                    data-excel-row={rowIdx}
                    data-excel-col={4}
                    type="number"
                    value={row.qty}
                    onChange={(e) => updateRow(row.id, { qty: Number(e.target.value) || 0 })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input cell-input--date"
                    data-excel-paste
                    data-excel-row={rowIdx}
                    data-excel-col={5}
                    type="date"
                    value={row.etdTcTech || ''}
                    onChange={(e) => updateRow(row.id, { etdTcTech: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input cell-input--date"
                    data-excel-paste
                    data-excel-row={rowIdx}
                    data-excel-col={6}
                    type="date"
                    value={row.etdPort || ''}
                    onChange={(e) => updateRow(row.id, { etdPort: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input cell-input--date"
                    data-excel-paste
                    data-excel-row={rowIdx}
                    data-excel-col={7}
                    type="date"
                    value={row.etaPort || ''}
                    onChange={(e) => updateRow(row.id, { etaPort: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    data-excel-paste
                    data-excel-row={rowIdx}
                    data-excel-col={8}
                    value={row.deliveryLocation ?? ''}
                    onChange={(e) =>
                      updateRow(row.id, { deliveryLocation: e.target.value })
                    }
                  />
                </td>
                <td className="cell--center">
                  <input
                    type="checkbox"
                    data-excel-paste
                    data-excel-row={rowIdx}
                    data-excel-col={9}
                    checked={!!row.arrived}
                    onChange={(e) => updateRow(row.id, { arrived: e.target.checked })}
                    title="입고 완료 후 저장 시 창고 재고에 반영되고 행은 제거됩니다."
                  />
                </td>
                <td className="transit-page__td--remark">
                  <input
                    className="cell-input transit-page__cell-input--remark"
                    data-excel-paste
                    data-excel-row={rowIdx}
                    data-excel-col={10}
                    value={row.remark ?? ''}
                    onChange={(e) => updateRow(row.id, { remark: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input transit-page__cell-input--tctech"
                    data-excel-paste
                    data-excel-row={rowIdx}
                    data-excel-col={11}
                    value={row.tcTechNo ?? ''}
                    onChange={(e) => updateRow(row.id, { tcTechNo: e.target.value })}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn--ghost transit-page__btn-del"
                    onClick={() => requestDeleteRow(row.id)}
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
