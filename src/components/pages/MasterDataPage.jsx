import { useCallback, useMemo, useRef, useState } from 'react'
import useGridNativePaste from '../../hooks/useGridNativePaste'
import { getEnabledProducts } from '../../config/products'
import { MIN_MANAGEMENT_WEEKS } from '../../config/inventoryPolicy'
import { operationsMeta } from '../../data/logisticsSampleData'
import useUnsavedDraft from '../../hooks/useUnsavedDraft'
import { L, formatKoEn, formatKoEnInline } from '../../i18n/labels'
import { buildItemInventoryStatus } from '../../utils/inventoryCoverage'
import { cloneJson } from '../../utils/draftState'
import { parseQtyCell } from '../../utils/excelGridClipboard'
import { downloadXlsxFromAoA, readXlsxFirstSheetMatrix } from '../../utils/excelFile'
import { useMobileSimpleLayout } from '../../utils/mobileLayout'
import { normalizeModel } from '../../utils/modelName'
import { newId } from '../../utils/newId'
import { inventoryRemoteSyncEnabled } from '../../utils/inventoryRemoteSync'
import PageDataToolbar from '../grid/PageDataToolbar.jsx'
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

const EMPTY_SEARCH = { model: '', part: '', desc: '' }

function lc(s) {
  return String(s ?? '').toLowerCase()
}

function rowMatchesMasterSearch(row, applied) {
  if (applied.model && !lc(row.modelName).includes(applied.model)) return false
  if (applied.part && !lc(row.partNo).includes(applied.part)) return false
  if (applied.desc && !lc(row.description).includes(applied.desc)) return false
  return true
}

function matrixSkipHeaderRow(matrix) {
  if (!matrix?.length) return []
  const c0 = String(matrix[0]?.[0] ?? '').toLowerCase()
  if (c0.includes('model')) return matrix.slice(1)
  return matrix
}

/** 화면(필터) 기준 행·열 앵커로 마스터 그리드 붙여넣기 */
function applyMasterPasteFromDisplay(prev, matrix, dispRow, dispCol, appliedSearch) {
  const errs = []
  const bad = new Set()
  const displayed = prev.filter((r) => rowMatchesMasterSearch(r, appliedSearch))
  const next = [...prev]

  for (let r = 0; r < matrix.length; r++) {
    const disp = displayed[dispRow + r]
    if (!disp) break
    const rowIdx = next.findIndex((x) => x.id === disp.id)
    if (rowIdx < 0) continue
    const row = { ...next[rowIdx] }
    for (let mc = 0; mc < matrix[r].length; mc++) {
      const fi = dispCol + mc
      if (fi >= MASTER_COLS.length) break
      const field = MASTER_COLS[fi]
      const cell = String(matrix[r][mc] ?? '').trim()
      if (cell === '') continue
      if (
        field === 'currentStock' ||
        field === 'weeklyDemand' ||
        field === 'safetyStockWeeks' ||
        field === 'leadTime'
      ) {
        const p = parseQtyCell(cell)
        if (!p.ok) {
          errs.push(`R${r + 1} C${mc + 1}: ${field} — not a number`)
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
      } else if (field === 'modelName') {
        row.modelName = normalizeModel(cell)
      } else {
        row[field] = cell
      }
    }
    if (!String(row.modelName).trim() || !String(row.partNo).trim()) {
      errs.push(`Row ${dispRow + r + 1}: Model and Part No are required`)
      bad.add(row.id)
    }
    next[rowIdx] = row
  }
  return { next, errs, bad }
}

function formatCoverageWeeks(weeks) {
  if (weeks == null || !Number.isFinite(weeks)) return '—'
  return `${weeks.toFixed(1)}`
}

export default function MasterDataPage({
  masterItems: savedMasterItems,
  onPersistMasterItems,
  registerUnsavedGuard,
  deliveryPlans = [],
  inTransit = [],
  opsMeta,
}) {
  const isMobile = useMobileSimpleLayout()
  const products = getEnabledProducts()

  const { draft: masterItems, setDraft: setMasterItems } = useUnsavedDraft({
    saved: savedMasterItems,
    clone: cloneJson,
    registerUnsavedGuard,
    guardId: 'master',
  })

  const [saveHint, setSaveHint] = useState('')
  const [excelMsg, setExcelMsg] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [invalidIds, setInvalidIds] = useState(() => new Set())
  const [searchModel, setSearchModel] = useState('')
  const [searchPart, setSearchPart] = useState('')
  const [searchDesc, setSearchDesc] = useState('')
  const [appliedSearch, setAppliedSearch] = useState(() => ({ ...EMPTY_SEARCH }))
  const masterTableRef = useRef(null)

  const asOfDate = opsMeta?.asOfDate ?? operationsMeta.asOfDate

  const displayedRows = useMemo(
    () => masterItems.filter((r) => rowMatchesMasterSearch(r, appliedSearch)),
    [masterItems, appliedSearch],
  )

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
    setSaveHint(
      formatKoEn(inventoryRemoteSyncEnabled() ? L.savedAfterEditWithRemote : L.savedToBrowserStorage),
    )
    setTimeout(() => setSaveHint(''), 2500)
  }

  function handleSave() {
    if (typeof onPersistMasterItems === 'function') onPersistMasterItems(masterItems)
    flashSaved()
  }

  function updateRow(id, patch) {
    const next = { ...patch }
    if ('modelName' in next) next.modelName = normalizeModel(next.modelName)
    setMasterItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...next } : r)))
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

  function applySearchFromForm() {
    setAppliedSearch({
      model: searchModel.trim().toLowerCase(),
      part: searchPart.trim().toLowerCase(),
      desc: searchDesc.trim().toLowerCase(),
    })
  }

  function resetSearch() {
    setSearchModel('')
    setSearchPart('')
    setSearchDesc('')
    setAppliedSearch({ ...EMPTY_SEARCH })
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
      if (s.size === displayedRows.length && displayedRows.length > 0) return new Set()
      return new Set(displayedRows.map((r) => r.id))
    })
  }, [displayedRows])

  const onMasterPasteMatrix = useCallback(
    (matrix, cell) => {
      const dispRow = Number(cell.dataset.excelRow)
      const dispCol = Number(cell.dataset.excelCol)
      if (!Number.isFinite(dispRow) || !Number.isFinite(dispCol)) return
      const m = matrixSkipHeaderRow(matrix)
      if (!m.length) return
      setExcelMsg('')
      setMasterItems((prev) => {
        const out = applyMasterPasteFromDisplay(prev, m, dispRow, dispCol, appliedSearch)
        queueMicrotask(() => {
          setInvalidIds(out.bad)
          setExcelMsg(
            out.errs.length ? `!${out.errs.join('\n')}` : formatKoEn(L.excelUploadApplied),
          )
        })
        return out.next
      })
    },
    [appliedSearch],
  )

  useGridNativePaste({
    tableRef: masterTableRef,
    enabled: !isMobile,
    onPasteMatrix: onMasterPasteMatrix,
  })

  const applyMasterMatrix = useCallback((matrix, startRowIdx, startColIdx = 0) => {
    setExcelMsg('')
    setInvalidIds(new Set())
    const errs = []
    const bad = new Set()

    setMasterItems((prev) => {
      const next = [...prev]
      for (let r = 0; r < matrix.length; r++) {
        let rowIdx = startRowIdx + r
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
        for (let mc = 0; mc < matrix[r].length; mc++) {
          const fi = startColIdx + mc
          if (fi >= MASTER_COLS.length) break
          const field = MASTER_COLS[fi]
          const cell = String(matrix[r][mc] ?? '').trim()
          if (cell === '') continue
          if (
            field === 'currentStock' ||
            field === 'weeklyDemand' ||
            field === 'safetyStockWeeks' ||
            field === 'leadTime'
          ) {
            const p = parseQtyCell(cell)
            if (!p.ok) {
              errs.push(`R${r + 1} C${mc + 1}: ${field} — not a number`)
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
          } else if (field === 'modelName') {
            row.modelName = normalizeModel(cell)
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
    setExcelMsg(errs.length ? `!${errs.join('\n')}` : formatKoEn(L.excelUploadApplied))
  }, [])

  async function handleMasterUpload(ev) {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return
    setExcelMsg('')
    try {
      const raw = await readXlsxFirstSheetMatrix(file)
      const matrix = matrixSkipHeaderRow(raw)
      if (!matrix.length) {
        setExcelMsg(`!${formatKoEn(L.excelClipboardEmpty)}`)
        return
      }
      applyMasterMatrix(matrix, 0, 0)
      setTimeout(() => setExcelMsg(''), 3500)
    } catch (err) {
      setExcelMsg(`!${String(err?.message || err)}`)
    }
  }

  function handleDownloadXlsx() {
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
    const body = displayedRows.map((row) => [
      row.modelName ?? '',
      row.partNo ?? '',
      row.description ?? '',
      String(row.currentStock ?? ''),
      String(row.weeklyDemand ?? ''),
      String(row.safetyStockWeeks ?? ''),
      String(row.leadTime ?? ''),
      row.status ?? '',
    ])
    downloadXlsxFromAoA('WarehouseInventory', 'Warehouse', [header, ...body])
    setExcelMsg(formatKoEn(L.excelExportDone))
    setTimeout(() => setExcelMsg(''), 2500)
  }

  return (
    <div className="page page--wide">
      <header className="page__header">
        <h1>
          <BilingualLabel label={L.warehouseInventoryScreen} as="span" />
        </h1>
        <p className="page__desc">
          <BilingualLabel label={L.warehouseInventorySubtitle} as="span" />
        </p>
        <PageDataToolbar
          hideUpload={isMobile}
          hideDownload={isMobile}
          onUploadChange={handleMasterUpload}
          onDownload={handleDownloadXlsx}
          downloadDisabled={displayedRows.length === 0}
          onSave={handleSave}
          message={excelMsg}
          extra={
            <button type="button" className="btn btn--ghost btn--toolbar" onClick={handleAdd}>
              <BilingualLabel label={L.warehouseAddItem} as="span" />
            </button>
          }
          searchSlot={
            <form
              className="page-search-strip"
              onSubmit={(e) => {
                e.preventDefault()
                applySearchFromForm()
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
                <label className="page-search-strip__field">
                  <span className="page-search-strip__label">
                    <BilingualLabel label={L.pageSearchDescription} as="span" />
                  </span>
                  <input
                    className="cell-input"
                    value={searchDesc}
                    onChange={(e) => setSearchDesc(e.target.value)}
                    aria-label={formatKoEnInline(L.pageSearchDescription)}
                  />
                </label>
              </div>
              <div className="page-search-strip__actions">
                <button type="submit" className="btn btn--primary btn--toolbar">
                  <BilingualLabel label={L.pageSearchButton} as="span" />
                </button>
                <button type="button" className="btn btn--ghost btn--toolbar" onClick={resetSearch}>
                  <BilingualLabel label={L.pageSearchReset} as="span" />
                </button>
              </div>
            </form>
          }
        />
        {saveHint && (
          <p className="page__hint" role="status">
            {saveHint}
          </p>
        )}
      </header>

      <div className="table-wrap page__table">
        <table ref={masterTableRef} className="ops-table master-table">
          <thead>
            <tr>
              <th className="cell--center" style={{ width: '2rem' }}>
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={
                    displayedRows.length > 0 && selected.size === displayedRows.length
                  }
                  onChange={toggleSelectAll}
                />
              </th>
              <th>
                <BilingualLabel label={L.model} as="span" />
              </th>
              <th>
                <BilingualLabel label={L.partNo} as="span" />
              </th>
              <th>
                <BilingualLabel label={L.description} as="span" />
              </th>
              <th>
                <BilingualLabel label={L.currentStock} as="span" />
              </th>
              <th>
                <BilingualLabel label={L.coverageWeeks} as="span" />
              </th>
              <th>
                <BilingualLabel label={L.weeklyDemand} as="span" />
              </th>
              <th>
                <BilingualLabel label={L.safetyStockWeeks} as="span" />
              </th>
              <th>
                <BilingualLabel label={L.leadTimeDays} as="span" />
              </th>
              <th>
                <BilingualLabel label={L.status} as="span" />
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((row, rowIdx) => {
              const st = itemStatusById.get(row.id)
              const cov = st?.coverageWeeks
              return (
                <tr
                  key={row.id}
                  className={invalidIds.has(row.id) ? 'row--excel-invalid' : undefined}
                >
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
                      data-excel-paste
                      data-excel-row={rowIdx}
                      data-excel-col={0}
                      onChange={(e) => updateRow(row.id, { modelName: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input"
                      value={row.partNo}
                      data-excel-paste
                      data-excel-row={rowIdx}
                      data-excel-col={1}
                      onChange={(e) => updateRow(row.id, { partNo: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input master-table__desc"
                      value={row.description}
                      data-excel-paste
                      data-excel-row={rowIdx}
                      data-excel-col={2}
                      onChange={(e) => updateRow(row.id, { description: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input cell-input--num"
                      type="number"
                      value={row.currentStock}
                      data-excel-paste
                      data-excel-row={rowIdx}
                      data-excel-col={3}
                      onChange={(e) =>
                        updateRow(row.id, { currentStock: Number(e.target.value) || 0 })
                      }
                    />
                  </td>
                  <td className="cell--num cell--muted" title={formatKoEn(L.flowCoverageHeroHint)}>
                    {formatCoverageWeeks(cov)}
                  </td>
                  <td>
                    <input
                      className="cell-input cell-input--num"
                      type="number"
                      value={row.weeklyDemand}
                      data-excel-paste
                      data-excel-row={rowIdx}
                      data-excel-col={4}
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
                      data-excel-paste
                      data-excel-row={rowIdx}
                      data-excel-col={5}
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
                      data-excel-paste
                      data-excel-row={rowIdx}
                      data-excel-col={6}
                      onChange={(e) =>
                        updateRow(row.id, { leadTime: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                  </td>
                  <td>
                    <select
                      className="cell-input"
                      value={row.status}
                      data-excel-paste
                      data-excel-row={rowIdx}
                      data-excel-col={7}
                      onChange={(e) => updateRow(row.id, { status: e.target.value })}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--ghost btn--toolbar"
                      onClick={() => handleDelete(row.id)}
                    >
                      <BilingualLabel label={L.transitRowDelete} as="span" />
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
