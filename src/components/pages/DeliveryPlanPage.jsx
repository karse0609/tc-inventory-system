import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, forwardRef } from 'react'
import { AgGridReact } from 'ag-grid-react'
import useUnsavedDraft from '../../hooks/useUnsavedDraft'
import BilingualLabel from '../BilingualLabel'
import { operationsMeta } from '../../data/logisticsSampleData'
import { formatKoEn, formatKoEnInline, L } from '../../i18n/labels'
import { buildWeekHorizon, planWeekMonday } from '../../utils/deliveryPlanHorizon'
import { getWeekRange } from '../../utils/logisticsMetrics'
import { parseQtyCell } from '../../utils/excelGridClipboard'
import { matrixFromClipboardText, copyGridSelectionAsTsv } from '../../utils/agGridClipboard'
import { downloadXlsxFromAoA, readXlsxFirstSheetMatrix } from '../../utils/excelFile'
import { useMobileSimpleLayout } from '../../utils/mobileLayout'
import { cloneJson } from '../../utils/draftState'
import { normalizeModel } from '../../utils/modelName'
import { newId } from '../../utils/newId'
import { inventoryRemoteSyncEnabled } from '../../utils/inventoryRemoteSync'
import {
  committedQtyOnRecord,
  isWeekConfirmed,
  computeStockDeltasBySku,
  normalizeDeliveryPlansForPersist,
  applyStockDeltasToMasterItems,
  findInsufficientStockForDeltas,
  serializeWarehouseBaselinePlansSnapshot,
  parseWarehouseBaselinePlansSnapshot,
  logDeliveryPlanSaveWarehouseDebug,
} from '../../utils/deliveryPlanModel'
import PageDataToolbar from '../grid/PageDataToolbar.jsx'
import '../grid/tc-inv-ag-grid.css'
import '../logistics/ops.css'
import './pages.css'
import './DeliveryPlanPage.css'

const DEFAULT_PAST = 2
const DEFAULT_FUTURE = 22
const MAX_PAST_WEEKS = 52

const EMPTY_PART_SEARCH = { model: '', part: '' }

function buildSavedPlanDraft(cells, weekConfirmations) {
  return {
    cells: cells ?? [],
    weekConfirmations: weekConfirmations ?? {},
    draftRows: [],
  }
}

function clonePlanDraft(snapshot) {
  return {
    cells: cloneJson(snapshot?.cells ?? []),
    weekConfirmations: cloneJson(snapshot?.weekConfirmations ?? {}),
    draftRows: cloneJson(snapshot?.draftRows ?? []),
  }
}

function lc(s) {
  return String(s ?? '').toLowerCase()
}

function rowMatchesPartSearch(spec, applied) {
  if (applied.model && !lc(spec.modelName).includes(applied.model)) return false
  if (applied.part && !lc(spec.partNo).includes(applied.part)) return false
  return true
}

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
    planQty: qty,
    confirmedQty: idx >= 0 ? committedQtyOnRecord(prev) : 0,
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

function weekFieldId(wk) {
  return `wk_${wk}`
}

const DpWeekHeader = forwardRef(function DpWeekHeader(props, ref) {
  useImperativeHandle(ref, () => ({
    refresh() {
      return true
    },
  }))
  const ctx = props.context || {}
  const weekMonday = props.column?.getColDef?.()?.context?.weekMonday
  const col = props.column?.getColDef?.()?.context?.columnMeta
  const headerShort = col?.headerShort ?? col?.week ?? ''
  const title = `${col?.week ?? ''} · ${weekMonday ?? ''}`
  const weekConfirmed = weekMonday ? ctx.getWeekConfirmed?.(weekMonday) : false
  const headerLocked = weekMonday ? ctx.isWeekHeaderLocked?.(weekMonday) : false

  return (
    <div className="dp-week-head ag-header-cell-comp-wrapper" title={title}>
      <span className="dp-week-head__date">{headerShort}</span>
      <label className="dp-week-head__confirm">
        <input
          type="checkbox"
          checked={!!weekConfirmed}
          disabled={headerLocked || ctx.inventoryReadOnly}
          onChange={(e) => ctx.onWeekHeaderConfirmChange?.(weekMonday, e.target.checked)}
          aria-label={formatKoEnInline(L.deliveryPlanWeekShipConfirm)}
        />
        <span className="dp-week-head__confirm-text">
          <BilingualLabel label={L.deliveryPlanWeekShipConfirm} as="span" compact />
        </span>
      </label>
    </div>
  )
})

function DpDeleteRenderer(props) {
  const ctx = props.context || {}
  const d = props.data || {}
  const spec = {
    rowKey: d.rowKey,
    kind: d.kind,
    draftId: d.draftId,
    modelName: d.modelName,
    partNo: d.partNo,
  }
  const canQuickRemoveDraft =
    spec.kind === 'draft' && (!String(spec.modelName || '').trim() || !String(spec.partNo || '').trim())
  const showDeleteConfirm = spec.kind === 'master' || spec.kind === 'plan' || (spec.kind === 'draft' && !canQuickRemoveDraft)
  const deleteDisabled = spec.kind === 'draft' && canQuickRemoveDraft ? false : !spec.modelName || !spec.partNo
  const deleteDisabledOrReadOnly = deleteDisabled || ctx.inventoryReadOnly

  return (
    <button
      type="button"
      className="btn btn--ghost dp-btn-delete-row"
      disabled={deleteDisabledOrReadOnly}
      title={formatKoEnInline(L.actionDelete)}
      aria-label={formatKoEnInline(L.actionDelete)}
      onClick={() => {
        if (deleteDisabledOrReadOnly) return
        if (showDeleteConfirm) ctx.requestDeleteRow?.(spec)
        else ctx.removeDraft?.(spec.draftId)
      }}
    >
      <BilingualLabel label={L.actionDelete} as="span" />
    </button>
  )
}

export default function DeliveryPlanPage({
  masterItems,
  onPersistMasterItems,
  deliveryPlans: savedDeliveryPlans,
  weekConfirmations: savedWeekConfirmations,
  onPersistPlanStore,
  registerUnsavedGuard,
  opsMeta,
  onRequestRemoteSync,
  inventoryReadOnly = false,
}) {
  const isMobile = useMobileSimpleLayout()
  const asOfDate = opsMeta?.asOfDate ?? operationsMeta.asOfDate
  const [pastWeeks, setPastWeeks] = useState(DEFAULT_PAST)
  const [futureWeeks, setFutureWeeks] = useState(DEFAULT_FUTURE)
  const [weekOffset, setWeekOffset] = useState(0)

  const savedPlanDraft = useMemo(
    () => buildSavedPlanDraft(savedDeliveryPlans, savedWeekConfirmations),
    [savedDeliveryPlans, savedWeekConfirmations],
  )

  const { draft, setDraft } = useUnsavedDraft({
    saved: savedPlanDraft,
    clone: clonePlanDraft,
    registerUnsavedGuard,
    guardId: 'delivery',
  })

  const deliveryPlans = draft.cells
  const weekConfirmations = draft.weekConfirmations
  const draftRows = draft.draftRows

  const setDeliveryPlans = useCallback(
    (updater) => {
      setDraft((d) => ({
        ...d,
        cells: typeof updater === 'function' ? updater(d.cells) : updater,
      }))
    },
    [setDraft],
  )

  const setWeekConfirmations = useCallback(
    (updater) => {
      setDraft((d) => ({
        ...d,
        weekConfirmations:
          typeof updater === 'function' ? updater(d.weekConfirmations) : { ...updater },
      }))
    },
    [setDraft],
  )

  const setDraftRows = useCallback(
    (updater) => {
      setDraft((d) => ({
        ...d,
        draftRows: typeof updater === 'function' ? updater(d.draftRows) : updater,
      }))
    },
    [setDraft],
  )

  const [saveHint, setSaveHint] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [excelMsg, setExcelMsg] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [invalidRowKeys, setInvalidRowKeys] = useState(() => new Set())
  const [searchModel, setSearchModel] = useState('')
  const [searchPart, setSearchPart] = useState('')
  const [appliedPartSearch, setAppliedPartSearch] = useState(() => ({ ...EMPTY_PART_SEARCH }))
  /** 직전 출고저장(재고 반영 기준) 스냅샷 — 자동 저장 중간값으로 prev가 깨져 중복 차감되지 않도록 ref 유지 */
  const lastWarehouseBaselineRef = useRef(
    serializeWarehouseBaselinePlansSnapshot(savedDeliveryPlans, savedWeekConfirmations),
  )
  const gridApiRef = useRef(null)

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

  const displayedPartRows = useMemo(
    () => partRows.filter((p) => rowMatchesPartSearch(p, appliedPartSearch)),
    [partRows, appliedPartSearch],
  )

  useEffect(() => {
    if (!deleteTarget) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setDeleteTarget(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteTarget])

  const onWeekHeaderConfirmChange = useCallback(
    (weekMonday, checked) => {
      if (inventoryReadOnly) return
      setWeekConfirmations((prev) => {
        const next = { ...prev }
        if (checked) next[weekMonday] = true
        else delete next[weekMonday]
        return next
      })
    },
    [setWeekConfirmations, inventoryReadOnly],
  )

  const onQtyChange = useCallback(
    (modelName, partNo) => (col, raw) => {
      if (inventoryReadOnly) return
      if (!modelName || !partNo) return
      const wk = weekStartFromCol(col)
      setDeliveryPlans((plans) => mergeCellUpdate(plans, modelName, partNo, wk, raw))
    },
    [setDeliveryPlans, inventoryReadOnly],
  )

  function handleSave() {
    if (inventoryReadOnly) return
    const prev = parseWarehouseBaselinePlansSnapshot(lastWarehouseBaselineRef.current)
    const nextRaw = deliveryPlans
    const deltas = computeStockDeltasBySku(prev.cells, nextRaw, weekConfirmations)
    const bad = findInsufficientStockForDeltas(masterItems, deltas)
    if (bad.length) {
      const lines = bad.map((b) =>
        `${b.modelName} / ${b.partNo} — ${formatKoEnInline({
          ko: `재고 ${b.stock}, 부족 ${b.need}`,
          en: `stock ${b.stock}, short by ${b.need}`,
        })}`,
      )
      window.alert(`${formatKoEnInline(L.deliveryPlanInsufficientStock)}\n\n${lines.join('\n')}`)
      return
    }
    const normalized = normalizeDeliveryPlansForPersist(nextRaw, weekConfirmations)
    logDeliveryPlanSaveWarehouseDebug({
      prevPlans: prev.cells,
      nextPlans: nextRaw,
      nextWeekConfirmations: weekConfirmations,
      masterItems,
    })
    const nextMaster = applyStockDeltasToMasterItems(masterItems, deltas)
    if (typeof onPersistMasterItems === 'function') onPersistMasterItems(nextMaster)
    if (typeof onPersistPlanStore === 'function') {
      onPersistPlanStore({ cells: normalized, weekConfirmations })
    }
    lastWarehouseBaselineRef.current = serializeWarehouseBaselinePlansSnapshot(
      normalized,
      weekConfirmations,
    )
    setDraft({ cells: normalized, weekConfirmations, draftRows: [] })
    setSaveHint(
      formatKoEn(inventoryRemoteSyncEnabled() ? L.savedAfterEditWithRemote : L.savedToBrowserStorage),
    )
    setTimeout(() => setSaveHint(''), 2500)
    if (typeof onRequestRemoteSync === 'function') onRequestRemoteSync()
  }

  function addDraftRow() {
    if (inventoryReadOnly) return
    setDraftRows((r) => [...r, { id: newId('draft'), modelName: '', partNo: '' }])
  }

  const removeDraft = useCallback(
    (draftId) => {
      if (inventoryReadOnly) return
      setDraftRows((rows) => rows.filter((d) => d.id !== draftId))
    },
    [inventoryReadOnly, setDraftRows],
  )

  const updateDraft = useCallback(
    (draftId, patch) => {
      if (inventoryReadOnly) return
      setDraftRows((rows) => rows.map((d) => (d.id === draftId ? { ...d, ...patch } : d)))
    },
    [inventoryReadOnly, setDraftRows],
  )

  const requestDeleteRow = useCallback(
    (spec) => {
      if (inventoryReadOnly) return
      const { modelName, partNo, kind, draftId } = spec
      if (kind === 'draft' && (!String(modelName || '').trim() || !String(partNo || '').trim())) {
        removeDraft(draftId)
        return
      }
      setDeleteTarget({ modelName, partNo, kind, draftId })
    },
    [inventoryReadOnly, removeDraft],
  )

  function confirmDeletePartPlans() {
    if (inventoryReadOnly) return
    if (!deleteTarget) return
    const { modelName, partNo, kind, draftId } = deleteTarget
    const nextPlans = deliveryPlans.filter((p) => !(p.modelName === modelName && p.partNo === partNo))
    setDraft((d) => ({
      ...d,
      cells: nextPlans,
      draftRows:
        kind === 'draft' && draftId
          ? d.draftRows.filter((row) => row.id !== draftId)
          : d.draftRows,
    }))
    setDeleteTarget(null)
  }

  function cancelDeletePartPlans() {
    setDeleteTarget(null)
  }

  const weekPasteReadOnly = useCallback(
    (spec, col, plan) => {
      if (inventoryReadOnly) return true
      const cellDisabled =
        (spec.kind === 'draft' && (!spec.modelName || !spec.partNo)) ||
        (spec.kind === 'plan' && (!spec.modelName || !spec.partNo))
      if (cellDisabled) return true
      const mon = weekStartFromCol(col)
      const weekRange = getWeekRange(asOfDate)
      const isFutureWeek = mon > weekRange.end
      const lockedByRow = plan?.locked === true
      const lockedByPolicy = FUTURE_WEEKS_LOCKED && isFutureWeek
      return lockedByRow || lockedByPolicy
    },
    [asOfDate, inventoryReadOnly],
  )

  const runPlanMatrixPaste = useCallback(
    (matrix, anchor, startRowIdx) => {
      if (inventoryReadOnly) return
      if (!matrix?.length || !anchor) return
      setExcelMsg('')
      setInvalidRowKeys(new Set())
      const errs = []
      const invalid = new Set()

      let plans = [...deliveryPlans]
      let drafts = [...draftRows]
      const rowsList = partRows.map((s) => ({ ...s }))

      function ensureRow(idx) {
        while (idx >= rowsList.length) {
          const id = newId('draft')
          drafts.push({ id, modelName: '', partNo: '' })
          rowsList.push({
            rowKey: `d:${id}`,
            kind: 'draft',
            draftId: id,
            modelName: '',
            partNo: '',
          })
        }
      }

      function planAt(spec, wk) {
        return plans.find(
          (p) =>
            p.modelName === spec.modelName && p.partNo === spec.partNo && planWeekMonday(p) === wk,
        )
      }

      function applyQty(spec, col, raw) {
        const wk = weekStartFromCol(col)
        const pl = planAt(spec, wk)
        if (weekPasteReadOnly(spec, col, pl)) return
        if (!spec.modelName || !spec.partNo) {
          errs.push(`${spec.rowKey}: Model / Part required for week paste`)
          invalid.add(spec.rowKey)
          return
        }
        plans = mergeCellUpdate(plans, spec.modelName, spec.partNo, wk, raw)
      }

      function setModelPart(spec, newModel, newPart) {
        const oldM = spec.modelName
        const oldP = spec.partNo
        const normModel = normalizeModel(newModel)
        if (spec.kind === 'draft') {
          drafts = drafts.map((d) =>
            d.id === spec.draftId ? { ...d, modelName: normModel, partNo: newPart } : d,
          )
          spec.modelName = normModel
          spec.partNo = newPart
          return
        }
        if (spec.kind === 'plan') {
          plans = plans.map((pl) =>
            pl.modelName === oldM && pl.partNo === oldP
              ? { ...pl, modelName: normModel, partNo: newPart }
              : pl,
          )
          spec.modelName = normModel
          spec.partNo = newPart
        }
      }

      for (let r = 0; r < matrix.length; r++) {
        const rowIdx = startRowIdx + r
        ensureRow(rowIdx)
        const spec = rowsList[rowIdx]
        const cells = matrix[r]

        if (anchor.colKind === 'week') {
          let wc = Number(anchor.weekColIndex) || 0
          if (wc < 0) wc = 0
          for (let c = 0; c < cells.length; c++) {
            const wi = wc + c
            if (wi >= columns.length) break
            const rawCell = cells[c]
            if (String(rawCell ?? '').trim() === '') continue
            const pq = parseQtyCell(rawCell)
            if (!pq.ok) {
              errs.push(`R${r + 1} C${c + 1}: not a number`)
              invalid.add(spec.rowKey)
              continue
            }
            const col = columns[wi]
            applyQty(spec, col, pq.value === 0 ? '' : String(pq.value))
          }
        } else if (anchor.colKind === 'model') {
          if (spec.kind === 'master') {
            errs.push(`R${r + 1}: Master row model/part are read-only — use week cell anchor`)
            invalid.add(spec.rowKey)
            continue
          }
          const newModel = String(cells[0] ?? '').trim()
          const newPart = String(cells[1] ?? '').trim()
          if (newModel || newPart)
            setModelPart(spec, newModel || spec.modelName, newPart || spec.partNo)
          for (let c = 2; c < cells.length; c++) {
            const wi = c - 2
            if (wi >= columns.length) break
            const rawCell = cells[c]
            if (String(rawCell ?? '').trim() === '') continue
            const pq = parseQtyCell(rawCell)
            if (!pq.ok) {
              errs.push(`R${r + 1} C${c + 1}: not a number`)
              invalid.add(spec.rowKey)
              continue
            }
            applyQty(spec, columns[wi], pq.value === 0 ? '' : String(pq.value))
          }
        } else if (anchor.colKind === 'part') {
          if (spec.kind === 'master') {
            errs.push(`R${r + 1}: Master row part column is read-only — use week cell anchor`)
            invalid.add(spec.rowKey)
            continue
          }
          const newPart = String(cells[0] ?? '').trim()
          if (newPart) setModelPart(spec, spec.modelName, newPart)
          for (let c = 1; c < cells.length; c++) {
            const wi = c - 1
            if (wi >= columns.length) break
            const rawCell = cells[c]
            if (String(rawCell ?? '').trim() === '') continue
            const pq = parseQtyCell(rawCell)
            if (!pq.ok) {
              errs.push(`R${r + 1} C${c + 1}: not a number`)
              invalid.add(spec.rowKey)
              continue
            }
            applyQty(spec, columns[wi], pq.value === 0 ? '' : String(pq.value))
          }
        }

        if (
          (spec.kind === 'draft' || spec.kind === 'plan') &&
          (!String(spec.modelName || '').trim() || !String(spec.partNo || '').trim())
        ) {
          invalid.add(spec.rowKey)
          if (!errs.some((e) => e.includes('Model / Part')))
            errs.push(`Row ${rowIdx + 1}: Model / Part No required`)
        }
      }

      setDeliveryPlans(plans)
      setDraftRows(drafts)
      setInvalidRowKeys(invalid)
      setExcelMsg(
        errs.length
          ? `!${errs.slice(0, 8).join('\n')}${errs.length > 8 ? '\n…' : ''}`
          : formatKoEn(L.excelUploadApplied),
      )
    },
    [deliveryPlans, draftRows, partRows, columns, weekPasteReadOnly, inventoryReadOnly, setDeliveryPlans, setDraftRows],
  )

  const planGridRowData = useMemo(() => {
    return displayedPartRows.map((spec) => {
      const row = { ...spec }
      for (const col of columns) {
        const wk = weekStartFromCol(col)
        const pl = planByKey.get(`${spec.modelName}\t${spec.partNo}\t${wk}`)
        const q = pl?.qty
        row[weekFieldId(wk)] = q == null || q === '' ? '' : q
      }
      return row
    })
  }, [displayedPartRows, columns, planByKey])

  const planCopyColIds = useMemo(
    () => ['modelName', 'partNo', ...columns.map((c) => weekFieldId(weekStartFromCol(c)))],
    [columns],
  )

  const getWeekConfirmedCb = useCallback(
    (wk) => isWeekConfirmed(weekConfirmations, wk),
    [weekConfirmations],
  )

  const isWeekHeaderLockedCb = useCallback(
    (wk) => {
      const weekRangeHdr = getWeekRange(asOfDate)
      const isFutureWeekHdr = wk > weekRangeHdr.end
      return FUTURE_WEEKS_LOCKED && isFutureWeekHdr
    },
    [asOfDate],
  )

  const gridContext = useMemo(
    () => ({
      inventoryReadOnly,
      getWeekConfirmed: getWeekConfirmedCb,
      isWeekHeaderLocked: isWeekHeaderLockedCb,
      onWeekHeaderConfirmChange,
      requestDeleteRow,
      removeDraft,
    }),
    [
      inventoryReadOnly,
      getWeekConfirmedCb,
      isWeekHeaderLockedCb,
      onWeekHeaderConfirmChange,
      requestDeleteRow,
      removeDraft,
    ],
  )

  const columnDefs = useMemo(() => {
    const defs = [
      {
        field: 'modelName',
        headerName: formatKoEnInline(L.model),
        editable: (p) => p.data.kind !== 'master' && !inventoryReadOnly,
        pinned: 'left',
        width: 140,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'partNo',
        headerName: formatKoEnInline(L.partNo),
        editable: (p) => p.data.kind !== 'master' && !inventoryReadOnly,
        pinned: 'left',
        width: 120,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
    ]
    for (const col of columns) {
      const wk = weekStartFromCol(col)
      const fid = weekFieldId(wk)
      defs.push({
        colId: fid,
        field: fid,
        headerComponent: 'DpWeekHeader',
        context: { weekMonday: wk, columnMeta: col },
        width: 96,
        filter: 'agNumberColumnFilter',
        floatingFilter: true,
        type: 'numericColumn',
        editable: (p) => {
          const pl = planByKey.get(`${p.data.modelName}\t${p.data.partNo}\t${wk}`)
          return !weekPasteReadOnly(p.data, col, pl)
        },
        cellClass: () =>
          isWeekConfirmed(weekConfirmations, wk) ? 'dp-week-cell--week-confirmed' : undefined,
      })
    }
    defs.push({
      colId: 'dpDelete',
      headerName: formatKoEnInline(L.actionDelete),
      width: 88,
      pinned: 'right',
      sortable: false,
      filter: false,
      floatingFilter: false,
      suppressMovable: true,
      cellRenderer: 'DpDeleteRenderer',
    })
    return defs
  }, [
    columns,
    inventoryReadOnly,
    weekConfirmations,
    planByKey,
    weekPasteReadOnly,
  ])

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      resizable: true,
      singleClickEdit: true,
    }),
    [],
  )

  const getRowId = useCallback((p) => String(p.data?.rowKey ?? ''), [])

  const getRowClass = useCallback(
    (p) => (invalidRowKeys.has(p.data?.rowKey) ? 'row--excel-invalid' : undefined),
    [invalidRowKeys],
  )

  const onGridReady = useCallback((e) => {
    gridApiRef.current = e.api
  }, [])

  const onPlanCellValueChanged = useCallback(
    (e) => {
      if (inventoryReadOnly) return
      const f = e.colDef?.field
      const d = e.data
      if (!f || !d) return
      const v = e.newValue
      if (f === 'modelName') {
        const nm = normalizeModel(v)
        if (d.kind === 'draft') updateDraft(d.draftId, { modelName: nm })
        else if (d.kind === 'plan') {
          setDeliveryPlans((plans) =>
            plans.map((p) =>
              `${p.modelName}\t${p.partNo}` === `${d.modelName}\t${d.partNo}` ? { ...p, modelName: nm } : p,
            ),
          )
        }
        return
      }
      if (f === 'partNo') {
        const part = String(v ?? '')
        if (d.kind === 'draft') updateDraft(d.draftId, { partNo: part })
        else if (d.kind === 'plan') {
          setDeliveryPlans((plans) =>
            plans.map((p) =>
              `${p.modelName}\t${p.partNo}` === `${d.modelName}\t${d.partNo}` ? { ...p, partNo: part } : p,
            ),
          )
        }
        return
      }
      if (f.startsWith('wk_')) {
        const wk = f.slice(3)
        const col = columns.find((c) => weekStartFromCol(c) === wk)
        if (col) onQtyChange(d.modelName, d.partNo)(col, v === '' || v == null ? '' : String(v))
      }
    },
    [inventoryReadOnly, columns, onQtyChange, setDeliveryPlans, updateDraft],
  )

  const applyPlanClipboardPaste = useCallback(
    (api, text) => {
      if (inventoryReadOnly) return
      const matrix = matrixFromClipboardText(text)
      if (!matrix.length) return
      const cell = api.getFocusedCell()
      if (!cell) return
      const node = api.getDisplayedRowAtIndex(cell.rowIndex)
      if (!node?.data?.rowKey) return
      const colId = cell.column.getColId()
      const rowIndexDisp = displayedPartRows.findIndex((r) => r.rowKey === node.data.rowKey)
      if (rowIndexDisp < 0) return
      const startRowIdx = partRows.findIndex((p) => p.rowKey === node.data.rowKey)
      if (startRowIdx < 0) return
      let anchor
      if (colId === 'modelName') anchor = { rowIndex: rowIndexDisp, colKind: 'model', weekColIndex: 0 }
      else if (colId === 'partNo') anchor = { rowIndex: rowIndexDisp, colKind: 'part', weekColIndex: 0 }
      else if (colId.startsWith('wk_')) {
        const wk = colId.slice(3)
        const weekColIndex = Math.max(0, columns.findIndex((c) => weekStartFromCol(c) === wk))
        anchor = { rowIndex: rowIndexDisp, colKind: 'week', weekColIndex }
      } else return
      runPlanMatrixPaste(matrix, anchor, startRowIdx)
    },
    [inventoryReadOnly, displayedPartRows, partRows, columns, runPlanMatrixPaste],
  )

  const onPlanCellKeyDown = useCallback(
    (e) => {
      const ev = e.event
      if (!(ev.ctrlKey || ev.metaKey)) return
      const k = String(ev.key || '').toLowerCase()
      if (k === 'c') {
        ev.preventDefault()
        const tsv = copyGridSelectionAsTsv(e.api, planCopyColIds)
        if (tsv) void navigator.clipboard.writeText(tsv).catch(() => {})
        return
      }
      if (k === 'v' && !inventoryReadOnly) {
        ev.preventDefault()
        void navigator.clipboard.readText().then((t) => applyPlanClipboardPaste(e.api, t))
      }
    },
    [planCopyColIds, inventoryReadOnly, applyPlanClipboardPaste],
  )

  const onSelectionChanged = useCallback((e) => {
    const keys = new Set(e.api.getSelectedRows().map((r) => r.rowKey))
    setSelected(keys)
  }, [])

  useLayoutEffect(() => {
    const api = gridApiRef.current
    if (!api) return
    api.forEachNode((node) => {
      const on = node.data && selected.has(node.data.rowKey)
      node.setSelected(!!on, false, true)
    })
  }, [selected, planGridRowData])

  useEffect(() => {
    gridApiRef.current?.refreshHeader()
  }, [weekConfirmations])

  async function handleDpUpload(ev) {
    if (inventoryReadOnly) return
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return
    setExcelMsg('')
    try {
      const raw = await readXlsxFirstSheetMatrix(file)
      const matrix =
        raw.length && String(raw[0]?.[0] ?? '').toLowerCase().includes('model')
          ? raw.slice(1)
          : raw
      if (!matrix.length) {
        setExcelMsg(`!${formatKoEn(L.excelClipboardEmpty)}`)
        return
      }
      const start =
        displayedPartRows.length > 0
          ? Math.max(0, partRows.findIndex((p) => p.rowKey === displayedPartRows[0].rowKey))
          : 0
      runPlanMatrixPaste(matrix, { rowIndex: 0, colKind: 'model', weekColIndex: 0 }, start)
      setTimeout(() => setExcelMsg(''), 3500)
    } catch (err) {
      setExcelMsg(`!${String(err?.message || err)}`)
    }
  }

  function handleDpDownload() {
    setExcelMsg('')
    const header = ['Model', 'Part No', ...columns.map((c) => c.headerShort ?? c.week ?? '')]
    const body = displayedPartRows.map((spec) => {
      const cells = [spec.modelName ?? '', spec.partNo ?? '']
      for (const col of columns) {
        const wk = weekStartFromCol(col)
        const pl = planByKey.get(`${spec.modelName}\t${spec.partNo}\t${wk}`)
        const q = pl?.qty
        cells.push(q != null && q !== '' ? String(q) : '')
      }
      return cells
    })
    downloadXlsxFromAoA('DeliveryPlan', 'DeliveryPlan', [header, ...body])
    setExcelMsg(formatKoEn(L.excelExportDone))
    setTimeout(() => setExcelMsg(''), 2500)
  }

  const pastOptions = useMemo(
    () => Array.from({ length: MAX_PAST_WEEKS + 1 }, (_, i) => i),
    [],
  )

  return (
    <div className="page delivery-plan-page">
      <header className="page__header">
        <h1>
          <BilingualLabel label={L.deliveryPlanScreenTitle} as="span" />
        </h1>
        <p className="page__desc">
          <BilingualLabel
            label={inventoryRemoteSyncEnabled() ? L.deliveryPlanPageDescRemote : L.deliveryPlanPageDesc}
            as="span"
          />
        </p>
        <p className="page__desc page__desc--secondary">
          <BilingualLabel label={L.deliveryPlanScreenSubtitle} as="span" />
        </p>
        {inventoryReadOnly ? (
          <p className="page__hint page__hint--info" role="status">
            <BilingualLabel label={L.partnerReadOnlyInventory} as="span" />
          </p>
        ) : null}
        <PageDataToolbar
          hideUpload={isMobile || inventoryReadOnly}
          hideDownload={isMobile}
          onUploadChange={handleDpUpload}
          onDownload={handleDpDownload}
          downloadDisabled={displayedPartRows.length === 0}
          onSave={handleSave}
          saveDisabled={inventoryReadOnly}
          message={excelMsg}
          extra={
            <div className="delivery-plan-page__toolbar delivery-plan-page__toolbar--inline">
              <label>
                <BilingualLabel label={L.previousWeeksShown} as="span" />
                <select
                  value={pastWeeks}
                  onChange={(e) => setPastWeeks(Number(e.target.value))}
                  aria-label={formatKoEnInline(L.previousWeeksShown)}
                >
                  {pastOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <BilingualLabel label={L.futureWeeksShown} as="span" />
                <select
                  value={futureWeeks}
                  onChange={(e) => setFutureWeeks(Number(e.target.value))}
                  aria-label={formatKoEnInline(L.futureWeeksShown)}
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
                  className="btn btn--ghost btn--toolbar"
                  onClick={() => setWeekOffset((o) => o - 12)}
                >
                  <BilingualLabel label={L.previous12Weeks} as="span" />
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--toolbar"
                  onClick={() => setWeekOffset((o) => o + 12)}
                >
                  <BilingualLabel label={L.next12Weeks} as="span" />
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--toolbar"
                  onClick={() => {
                    setWeekOffset(0)
                    setPastWeeks(DEFAULT_PAST)
                    setFutureWeeks(DEFAULT_FUTURE)
                  }}
                >
                  <BilingualLabel label={L.currentBaseline} as="span" />
                </button>
              </div>
              <span className="page__hint" style={{ margin: 0 }}>
                {formatKoEnInline(L.opsQueryDateKst)}: <strong>{asOfDate}</strong> ·{' '}
                {formatKoEnInline(L.columnsCount)} {columns.length} {formatKoEnInline(L.weeks)}
                {weekOffset !== 0
                  ? ` · ${formatKoEnInline(L.viewOffsetWeeks)} ${weekOffset > 0 ? '+' : ''}${weekOffset} ${formatKoEnInline(L.weeks)}`
                  : ''}
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--toolbar"
                disabled={inventoryReadOnly}
                onClick={addDraftRow}
              >
                <BilingualLabel label={L.addSkuRow} as="span" />
              </button>
            </div>
          }
          searchSlot={
            <form
              className="page-search-strip"
              onSubmit={(e) => {
                e.preventDefault()
                setAppliedPartSearch({
                  model: searchModel.trim().toLowerCase(),
                  part: searchPart.trim().toLowerCase(),
                })
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
              </div>
              <div className="page-search-strip__actions">
                <button type="submit" className="btn btn--primary btn--toolbar">
                  <BilingualLabel label={L.pageSearchButton} as="span" />
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--toolbar"
                  onClick={() => {
                    setSearchModel('')
                    setSearchPart('')
                    setAppliedPartSearch({ ...EMPTY_PART_SEARCH })
                  }}
                >
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

      {deleteTarget && (
        <div
          className="dp-modal-backdrop"
          role="presentation"
          onClick={cancelDeletePartPlans}
        >
          <div
            className="dp-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dp-delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="dp-delete-title" className="dp-modal__title">
              <BilingualLabel label={L.deletePartPlansTitle} as="span" />
            </h2>
            <div className="dp-modal__body">
              <p>{L.deletePartPlansConfirm.ko}</p>
              <p className="dp-modal__body-en">{L.deletePartPlansConfirm.en}</p>
            </div>
            <div className="dp-modal__actions">
              <button type="button" className="btn btn--ghost" onClick={cancelDeletePartPlans}>
                <BilingualLabel label={L.actionCancel} as="span" />
              </button>
              <button type="button" className="btn btn--primary dp-btn-delete-confirm" onClick={confirmDeletePartPlans}>
                <BilingualLabel label={L.actionDelete} as="span" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="dp-table-wrap page__table dp-table-wrap--ag">
        <div className="ag-theme-quartz tc-inv-ag-shell tc-inv-ag-shell--fill">
          <AgGridReact
            rowData={planGridRowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={getRowId}
            context={gridContext}
            components={{
              DpWeekHeader,
              DpDeleteRenderer,
            }}
            rowSelection={{
              mode: 'multiRow',
              checkboxes: true,
              headerCheckbox: true,
              enableClickSelection: true,
            }}
            selectionColumnDef={{ width: 40, maxWidth: 44, suppressHeaderMenuButton: true }}
            suppressCellFocus={false}
            enableCellTextSelection
            getRowClass={getRowClass}
            onGridReady={onGridReady}
            onCellValueChanged={onPlanCellValueChanged}
            onCellKeyDown={onPlanCellKeyDown}
            onSelectionChanged={onSelectionChanged}
            stopEditingWhenCellsLoseFocus
            animateRows
          />
        </div>
      </div>
    </div>
  )
}
