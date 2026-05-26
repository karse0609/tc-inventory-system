import { useCallback, useMemo, useState } from 'react'
import { getEnabledProducts } from '../../config/products'
import { MIN_MANAGEMENT_WEEKS } from '../../config/inventoryPolicy'
import { operationsMeta } from '../../data/logisticsSampleData'
import { L, formatKoEn } from '../../i18n/labels'
import { saveJson, storageKeys } from '../../utils/appPersistence'
import { buildItemInventoryStatus } from '../../utils/inventoryCoverage'
import {
  matrixToTsv,
  parseQtyCell,
  readClipboardText,
  splitTsvToMatrix,
  writeClipboardText,
} from '../../utils/excelGridClipboard'
import { newId } from '../../utils/newId'
import ExcelGridToolbar from '../grid/ExcelGridToolbar.jsx'
import BilingualLabel from '../BilingualLabel'
import '../logistics/ops.css'
import './pages.css'

const MASTER_COLS = [
  'modelName',
  'partNo',
  'description',
  'currentStock',
  'weeklyDemand',
  'safetyStockWeeks',
  'leadTime',
  'status',
]

function formatCoverageWeeks(weeks) {
  if (weeks === Infinity) return '∞'
  if (!Number.isFinite(weeks)) return '—'
  return `${weeks.toFixed(1)}`
}

export default function MasterDataPage({
  masterItems,
  setMasterItems,
  deliveryPlans = [],
  inTransit = [],
  opsMeta,
}) {
  const products = getEnabledProducts()
  const [saveHint, setSaveHint] = useState('')
  const [excelMsg, setExcelMsg] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [invalidIds, setInvalidIds] = useState(() => new Set())

  const asOfDate = opsMeta?.asOfDate ?? operationsMeta.asOfDate

  const itemStatusById = useMemo(() => {
    const m = new Map()
    for (const row of masterItems) {
      m.set(
        row.id,
        buildItemInventoryStatus({
          item: row,
          itemDeliveryPlans: deliveryPlans,
          inTransitContainers: inTransit,
          asOfDate,
        }),
      )
    }
    return m
  }, [masterItems, deliveryPlans, inTransit, asOfDate])

  function flashSaved() {
    setSaveHint(formatKoEn(L.savedToBrowserStorage))
    setTimeout(() => setSaveHint(''), 2500)
  }

  function handleSave() {
    saveJson(storageKeys.master, masterItems)
    flashSaved()
  }

  function updateRow(id, patch) {
    setMasterItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function handleAdd() {
    setMasterItems((rows) => [
      ...rows,
      {
        id: newId('master'),
        modelName: '',
        partNo: '',
        description: '',
        currentStock: 0,
        unitPrice: 0,
        weeklyDemand: 0,
        safetyStockWeeks: MIN_MANAGEMENT_WEEKS,
        leadTime: 14,
        status: 'Active',
      },
    ])
  }

  function handleDelete(id) {
    setMasterItems((rows) => rows.filter((r) => r.id !== id))
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
      if (s.size === masterItems.length) return new Set()
      return new Set(masterItems.map((r) => r.id))
    })
  }, [masterItems])

  const firstSelectedIndex = useMemo(() => {
    if (!selected.size) return 0
    const ix = masterItems.findIndex((r) => selected.has(r.id))
    return ix >= 0 ? ix : 0
  }, [masterItems, selected])

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
    const errs = []
    const bad = new Set()
    const start = firstSelectedIndex

    setMasterItems((prev) => {
      const next = [...prev]
      for (let r = 0; r < matrix.length; r++) {
        const rowIdx = start + r
        while (rowIdx >= next.length) {
          next.push({
            id: newId('master'),
            modelName: '',
            partNo: '',
            description: '',
            currentStock: 0,
            unitPrice: 0,
            weeklyDemand: 0,
            safetyStockWeeks: MIN_MANAGEMENT_WEEKS,
            leadTime: 14,
            status: 'Active',
          })
        }
        const row = { ...next[rowIdx] }
        for (let c = 0; c < matrix[r].length && c < MASTER_COLS.length; c++) {
          const field = MASTER_COLS[c]
          const cell = String(matrix[r][c] ?? '').trim()
          if (cell === '') continue
          if (
            field === 'currentStock' ||
            field === 'weeklyDemand' ||
            field === 'safetyStockWeeks' ||
            field === 'leadTime'
          ) {
            const p = parseQtyCell(cell)
            if (!p.ok) {
              errs.push(`R${r + 1} C${c + 1}: ${field} — not a number`)
              bad.add(row.id)
              continue
            }
            if (field === 'safetyStockWeeks' || field === 'leadTime') {
              row[field] = Math.max(0, Math.round(p.value))
            } else {
              row[field] = Math.max(0, p.value)
            }
          } else if (field === 'status') {
            const v = cell.toLowerCase()
            row.status = v.startsWith('inact') ? 'Inactive' : 'Active'
          } else {
            row[field] = cell
          }
        }
        if (!String(row.modelName).trim() || !String(row.partNo).trim()) {
          errs.push(`Row ${rowIdx + 1}: Model and Part No are required`)
          bad.add(row.id)
        }
        next[rowIdx] = row
      }
      return next
    })

    setInvalidIds(bad)
    setExcelMsg(
      errs.length ? `!${errs.join('\n')}` : formatKoEn(L.excelPasteDone),
    )
  }, [firstSelectedIndex])

  const handleCopyToExcel = useCallback(async () => {
    setExcelMsg('')
    const header = [
      'Model',
      'Part No',
      'Description',
      'Current Stock',
      'Weekly Demand',
      'Safety (wks)',
      'Lead Time (d)',
      'Status',
    ]
    const rowsSrc =
      selected.size > 0 ? masterItems.filter((r) => selected.has(r.id)) : masterItems
    const body = rowsSrc.map((row) => [
      row.modelName ?? '',
      row.partNo ?? '',
      row.description ?? '',
      String(row.currentStock ?? ''),
      String(row.weeklyDemand ?? ''),
      String(row.safetyStockWeeks ?? ''),
      String(row.leadTime ?? ''),
      row.status ?? '',
    ])
    await writeClipboardText(matrixToTsv([header, ...body]))
    setExcelMsg(formatKoEn(L.excelCopyDone))
  }, [masterItems, selected])

  const handleClearSelected = useCallback(() => {
    if (!selected.size) return
    setMasterItems((rows) => rows.filter((r) => !selected.has(r.id)))
    setSelected(new Set())
    setInvalidIds(new Set())
    setExcelMsg('')
  }, [selected.size])

  return (
    <div className="page page--wide">
      <header className="page__header">
        <h1>
          <BilingualLabel label={L.warehouseInventoryScreen} compact as="span" />
        </h1>
        <p className="page__desc">
          <BilingualLabel label={L.warehouseInventorySubtitle} compact as="span" />
        </p>
        <ExcelGridToolbar
          onPasteFromExcel={handlePasteFromExcel}
          onCopyToExcel={handleCopyToExcel}
          onClearSelected={handleClearSelected}
          selectedCount={selected.size}
          message={excelMsg}
        />
        <div className="page__actions">
          <button type="button" className="btn btn--ghost" onClick={handleAdd}>
            Add Item
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
        <table className="ops-table master-table">
          <thead>
            <tr>
              <th className="cell--center" style={{ width: '2rem' }}>
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={masterItems.length > 0 && selected.size === masterItems.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>Model</th>
              <th>Part No</th>
              <th>Description</th>
              <th>Current Stock</th>
              <th>
                <BilingualLabel label={L.coverageWeeks} compact as="span" />
              </th>
              <th>Weekly Demand</th>
              <th>Safety (wks)</th>
              <th>Lead Time (d)</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {masterItems.map((row) => {
              const st = itemStatusById.get(row.id)
              const cov = st?.coverageWeeks
              return (
                <tr key={row.id} className={invalidIds.has(row.id) ? 'row--excel-invalid' : undefined}>
                  <td className="cell--center">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleSelect(row.id)}
                      aria-label={`Select ${row.partNo}`}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input"
                      list="model-options"
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
                      className="cell-input master-table__desc"
                      value={row.description}
                      onChange={(e) => updateRow(row.id, { description: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input cell-input--num"
                      type="number"
                      value={row.currentStock}
                      onChange={(e) =>
                        updateRow(row.id, { currentStock: Number(e.target.value) || 0 })
                      }
                    />
                  </td>
                  <td className="cell--num cell--muted" title={formatKoEn(L.demandBasedCoverage)}>
                    {formatCoverageWeeks(cov)}
                  </td>
                  <td>
                    <input
                      className="cell-input cell-input--num"
                      type="number"
                      value={row.weeklyDemand}
                      onChange={(e) =>
                        updateRow(row.id, { weeklyDemand: Number(e.target.value) || 0 })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input cell-input--num"
                      type="number"
                      min={0}
                      value={row.safetyStockWeeks ?? MIN_MANAGEMENT_WEEKS}
                      onChange={(e) =>
                        updateRow(row.id, {
                          safetyStockWeeks: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input cell-input--num"
                      type="number"
                      min={0}
                      value={row.leadTime ?? 0}
                      onChange={(e) =>
                        updateRow(row.id, { leadTime: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                  </td>
                  <td>
                    <select
                      className="cell-input"
                      value={row.status}
                      onChange={(e) => updateRow(row.id, { status: e.target.value })}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
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
              )
            })}
          </tbody>
        </table>
      </div>

      <datalist id="model-options">
        {products.map((p) => (
          <option key={p.modelName} value={p.modelName} />
        ))}
      </datalist>
    </div>
  )
}
