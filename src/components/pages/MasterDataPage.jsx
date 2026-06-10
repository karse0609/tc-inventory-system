import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
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
import { matrixFromClipboardText, copyGridSelectionAsTsv } from '../../utils/agGridClipboard'
import PageDataToolbar from '../grid/PageDataToolbar.jsx'
import BilingualLabel from '../BilingualLabel'
import '../grid/tc-inv-ag-grid.css'
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

function MasterDeleteRenderer(props) {
  return (
    <button
      type="button"
      className="btn btn--ghost btn--toolbar"
      disabled={props.context.readOnly}
      onClick={() => props.context.onDelete(props.data.id)}
    >
      <BilingualLabel label={L.transitRowDelete} as="span" />
    </button>
  )
}

export default function MasterDataPage({
  masterItems: savedMasterItems,
  onPersistMasterItems,
  registerUnsavedGuard,
  deliveryPlans = [],
  inTransit = [],
  opsMeta,
  readOnly = false,
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
  const gridApiRef = useRef(null)

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

  const rowData = useMemo(
    () =>
      displayedRows.map((row) => ({
        ...row,
        coverageDisplay: formatCoverageWeeks(itemStatusById.get(row.id)?.coverageWeeks),
      })),
    [displayedRows, itemStatusById],
  )

  function flashSaved() {
    setSaveHint(
      formatKoEn(inventoryRemoteSyncEnabled() ? L.savedAfterEditWithRemote : L.savedToBrowserStorage),
    )
    setTimeout(() => setSaveHint(''), 2500)
  }

  function handleSave() {
    if (readOnly) return
    if (typeof onPersistMasterItems === 'function') onPersistMasterItems(masterItems)
    flashSaved()
  }

  const updateRow = useCallback(
    (id, patch) => {
      if (readOnly) return
      const next = { ...patch }
      if ('modelName' in next) next.modelName = normalizeModel(next.modelName)
      setMasterItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...next } : r)))
    },
    [readOnly, setMasterItems],
  )

  function handleAdd() {
    if (readOnly) return
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

  const handleDeleteCb = useCallback(
    (id) => {
      if (readOnly) return
      setMasterItems((rows) => rows.filter((r) => r.id !== id))
      setSelected((s) => {
        const n = new Set(s)
        n.delete(id)
        return n
      })
    },
    [readOnly, setMasterItems],
  )

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

  const applyMasterMatrix = useCallback((matrix, startRowIdx, startColIdx = 0) => {
    if (readOnly) return
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
  }, [readOnly, setMasterItems])

  async function handleMasterUpload(ev) {
    if (readOnly) return
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

  const gridContext = useMemo(
    () => ({ readOnly, onDelete: handleDeleteCb }),
    [readOnly, handleDeleteCb],
  )

  const modelPickValues = useMemo(() => products.map((p) => p.modelName), [products])

  const columnDefs = useMemo(
    () => [
      {
        field: 'modelName',
        headerName: formatKoEnInline(L.model),
        editable: !readOnly,
        minWidth: 120,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: { values: modelPickValues, allowTyping: true, filterList: true },
      },
      {
        field: 'partNo',
        headerName: formatKoEnInline(L.partNo),
        editable: !readOnly,
        minWidth: 110,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'description',
        headerName: formatKoEnInline(L.description),
        editable: !readOnly,
        flex: 1,
        minWidth: 160,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'currentStock',
        headerName: formatKoEnInline(L.currentStock),
        editable: !readOnly,
        width: 120,
        filter: 'agNumberColumnFilter',
        floatingFilter: true,
        type: 'numericColumn',
      },
      {
        field: 'coverageDisplay',
        headerName: formatKoEnInline(L.coverageWeeks),
        editable: false,
        width: 110,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
        tooltipField: 'coverageDisplay',
      },
      {
        field: 'weeklyDemand',
        headerName: formatKoEnInline(L.weeklyDemand),
        editable: !readOnly,
        width: 120,
        filter: 'agNumberColumnFilter',
        floatingFilter: true,
        type: 'numericColumn',
      },
      {
        field: 'safetyStockWeeks',
        headerName: formatKoEnInline(L.safetyStockWeeks),
        editable: !readOnly,
        width: 110,
        filter: 'agNumberColumnFilter',
        floatingFilter: true,
        type: 'numericColumn',
      },
      {
        field: 'leadTime',
        headerName: formatKoEnInline(L.leadTimeDays),
        editable: !readOnly,
        width: 100,
        filter: 'agNumberColumnFilter',
        floatingFilter: true,
        type: 'numericColumn',
      },
      {
        field: 'status',
        headerName: formatKoEnInline(L.status),
        editable: !readOnly,
        width: 120,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ['Active', 'Inactive'] },
      },
      {
        colId: 'delete',
        headerName: '',
        width: 88,
        pinned: 'right',
        sortable: false,
        filter: false,
        floatingFilter: false,
        suppressMovable: true,
        cellRenderer: 'MasterDeleteRenderer',
      },
    ],
    [readOnly, modelPickValues],
  )

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      resizable: true,
      suppressHeaderMenuButton: false,
      singleClickEdit: true,
    }),
    [],
  )

  const onCellValueChanged = useCallback(
    (e) => {
      if (readOnly) return
      const f = e.colDef?.field
      if (!f || f === 'coverageDisplay') return
      const id = e.data?.id
      if (!id) return
      let v = e.newValue
      if (f === 'currentStock' || f === 'weeklyDemand') {
        v = Math.max(0, Number(v) || 0)
      } else if (f === 'safetyStockWeeks' || f === 'leadTime') {
        v = Math.max(0, Math.round(Number(v) || 0))
      } else if (f === 'status') {
        v = v === 'Inactive' ? 'Inactive' : 'Active'
      } else if (f === 'modelName') {
        v = normalizeModel(v)
      } else if (f === 'partNo' || f === 'description') {
        v = String(v ?? '')
      }
      updateRow(id, { [f]: v })
    },
    [readOnly, updateRow],
  )

  const applyClipboardPaste = useCallback(
    (api, text) => {
      if (readOnly) return
      const matrix = matrixSkipHeaderRow(matrixFromClipboardText(text))
      if (!matrix.length) return
      const cell = api.getFocusedCell()
      if (!cell) return
      const node = api.getDisplayedRowAtIndex(cell.rowIndex)
      if (!node?.data?.id) return
      const colId = cell.column.getColId()
      const pasteStartCol = MASTER_COLS.includes(colId) ? MASTER_COLS.indexOf(colId) : 0
      const dispRow = displayedRows.findIndex((r) => r.id === node.data.id)
      if (dispRow < 0) return
      setExcelMsg('')
      setMasterItems((prev) => {
        const out = applyMasterPasteFromDisplay(prev, matrix, dispRow, pasteStartCol, appliedSearch)
        queueMicrotask(() => {
          setInvalidIds(out.bad)
          setExcelMsg(
            out.errs.length ? `!${out.errs.join('\n')}` : formatKoEn(L.excelUploadApplied),
          )
        })
        return out.next
      })
    },
    [readOnly, appliedSearch, displayedRows, setMasterItems],
  )

  const onCellKeyDown = useCallback(
    (e) => {
      if (readOnly) return
      const ev = e.event
      if (!(ev.ctrlKey || ev.metaKey)) return
      const k = String(ev.key || '').toLowerCase()
      if (k === 'c') {
        ev.preventDefault()
        const tsv = copyGridSelectionAsTsv(e.api, MASTER_COLS)
        if (tsv) void navigator.clipboard.writeText(tsv).catch(() => {})
        return
      }
      if (k === 'v') {
        ev.preventDefault()
        void navigator.clipboard.readText().then((t) => applyClipboardPaste(e.api, t))
      }
    },
    [readOnly, applyClipboardPaste],
  )

  const onSelectionChanged = useCallback((e) => {
    const ids = new Set(e.api.getSelectedRows().map((r) => r.id))
    setSelected(ids)
  }, [])

  const getRowId = useCallback((p) => String(p.data.id), [])

  const getRowStyle = useCallback(
    (p) => (invalidIds.has(p.data?.id) ? { backgroundColor: 'rgba(254, 226, 226, 0.45)' } : undefined),
    [invalidIds],
  )

  const onGridReady = useCallback((e) => {
    gridApiRef.current = e.api
  }, [])

  useLayoutEffect(() => {
    const api = gridApiRef.current
    if (!api) return
    api.forEachNode((node) => {
      const on = node.data && selected.has(node.data.id)
      node.setSelected(!!on, false, true)
    })
  }, [selected, rowData])

  useEffect(() => {
    const api = gridApiRef.current
    if (!api) return
    api.refreshCells({ columns: ['coverageDisplay'], force: true })
  }, [itemStatusById])

  return (
    <div className="page page--wide page--ag-master">
      <header className="page__header">
        <h1>
          <BilingualLabel label={L.warehouseInventoryScreen} as="span" />
        </h1>
        <p className="page__desc">
          <BilingualLabel label={L.warehouseInventorySubtitle} as="span" />
        </p>
        {readOnly ? (
          <p className="page__hint page__hint--info" role="status">
            <BilingualLabel label={L.partnerReadOnlyInventory} as="span" />
          </p>
        ) : null}
        <PageDataToolbar
          hideUpload={isMobile || readOnly}
          hideDownload={isMobile}
          onUploadChange={handleMasterUpload}
          onDownload={handleDownloadXlsx}
          downloadDisabled={displayedRows.length === 0}
          onSave={handleSave}
          saveDisabled={readOnly}
          message={excelMsg}
          extra={
            readOnly ? null : (
              <button type="button" className="btn btn--ghost btn--toolbar" onClick={handleAdd}>
                <BilingualLabel label={L.warehouseAddItem} as="span" />
              </button>
            )
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

      {!isMobile ? (
        <div className="ag-theme-quartz tc-inv-ag-shell tc-inv-ag-shell--fill">
          <AgGridReact
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={getRowId}
            context={gridContext}
            components={{ MasterDeleteRenderer: MasterDeleteRenderer }}
            rowSelection={{
              mode: 'multiRow',
              checkboxes: true,
              headerCheckbox: true,
              enableClickSelection: true,
            }}
            selectionColumnDef={{ width: 44, maxWidth: 48, suppressHeaderMenuButton: true }}
            suppressCellFocus={false}
            enableCellTextSelection
            getRowStyle={getRowStyle}
            onGridReady={onGridReady}
            onCellValueChanged={onCellValueChanged}
            onCellKeyDown={onCellKeyDown}
            onSelectionChanged={onSelectionChanged}
            stopEditingWhenCellsLoseFocus
            animateRows
          />
        </div>
      ) : (
        <p className="page__hint">
          {formatKoEn({
            ko: '창고 재고 그리드는 넓은 화면에서 이용할 수 있습니다.',
            en: 'Open the warehouse grid on a wider screen for the full spreadsheet view.',
          })}
        </p>
      )}

      <datalist id="model-options">
        {products.map((p) => (
          <option key={p.modelName} value={p.modelName} />
        ))}
      </datalist>
    </div>
  )
}
