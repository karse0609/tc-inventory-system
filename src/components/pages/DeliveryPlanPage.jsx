import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BilingualLabel from '../BilingualLabel'
import { operationsMeta } from '../../data/logisticsSampleData'
import { formatKoEn, L } from '../../i18n/labels'
import { saveJson, storageKeys } from '../../utils/appPersistence'
import { buildWeekHorizon, planWeekMonday } from '../../utils/deliveryPlanHorizon'
import { getWeekRange } from '../../utils/logisticsMetrics'
import {
  matrixToTsv,
  parseQtyCell,
  readClipboardText,
  splitTsvToMatrix,
  writeClipboardText,
} from '../../utils/excelGridClipboard'
import { newId } from '../../utils/newId'
import useGridNativePaste from '../../hooks/useGridNativePaste.js'
import ExcelGridToolbar from '../grid/ExcelGridToolbar.jsx'
import '../logistics/ops.css'
import './pages.css'
import './DeliveryPlanPage.css'

const DEFAULT_PAST = 2
const DEFAULT_FUTURE = 22
const MAX_PAST_WEEKS = 52

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

function WeekCell({ col, plan, disabled, asOfDate, onQtyChange, onFocusAnchor, rowIndex, weekIdx }) {
  const mon = weekStartFromCol(col)
  const weekRange = getWeekRange(asOfDate)
  const isFutureWeek = mon > weekRange.end
  const lockedByRow = plan?.locked === true
  const lockedByPolicy = FUTURE_WEEKS_LOCKED && isFutureWeek
  const readOnly = disabled || lockedByRow || lockedByPolicy
  const val = plan?.qty ?? ''
  const ariaWeek = `${formatKoEn(L.deliveryPlanWeeklyQty)} · ${col.headerShort}`

  return (
    <td className="dp-week-cell dp-week-col" title={`${col.week} · ${mon}`}>
      <input
        className="dp-input dp-input--qty"
        type="number"
        min={0}
        step={1}
        disabled={readOnly}
        aria-label={ariaWeek}
        value={val === '' ? '' : val}
        data-excel-paste
        data-dp-row={rowIndex}
        data-dp-kind="week"
        data-dp-week-idx={weekIdx}
        onChange={(e) => onQtyChange(col, e.target.value)}
        onFocus={() => onFocusAnchor?.()}
      />
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
  const [weekOffset, setWeekOffset] = useState(0)
  const [draftRows, setDraftRows] = useState([])
  const [saveHint, setSaveHint] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [excelMsg, setExcelMsg] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [invalidRowKeys, setInvalidRowKeys] = useState(() => new Set())
  /** 붙여넣기 시작 위치: 행 인덱스 + 열 앵커(모델/부품/주차) */
  const pasteAnchorRef = useRef({ rowIndex: 0, colKind: 'week', weekColIndex: 0 })
  const dpTableRef = useRef(null)

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

  useEffect(() => {
    if (!deleteTarget) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setDeleteTarget(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteTarget])

  const onQtyChange = useCallback(
    (modelName, partNo) => (col, raw) => {
      if (!modelName || !partNo) return
      const wk = weekStartFromCol(col)
      setDeliveryPlans((plans) => mergeCellUpdate(plans, modelName, partNo, wk, raw))
    },
    [setDeliveryPlans],
  )

  function handleSave() {
    saveJson(storageKeys.plans, deliveryPlans)
    setSaveHint('saved')
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

  function requestDeleteRow(spec) {
    const { modelName, partNo, kind, draftId } = spec
    if (kind === 'draft' && (!String(modelName || '').trim() || !String(partNo || '').trim())) {
      removeDraft(draftId)
      return
    }
    setDeleteTarget({ modelName, partNo, kind, draftId })
  }

  function confirmDeletePartPlans() {
    if (!deleteTarget) return
    const { modelName, partNo, kind, draftId } = deleteTarget
    setDeliveryPlans((plans) =>
      plans.filter((p) => !(p.modelName === modelName && p.partNo === partNo)),
    )
    if (kind === 'draft' && draftId) removeDraft(draftId)
    setDeleteTarget(null)
  }

  function cancelDeletePartPlans() {
    setDeleteTarget(null)
  }

  const toggleSelect = useCallback((rowKey) => {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(rowKey)) n.delete(rowKey)
      else n.add(rowKey)
      return n
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelected((s) => {
      if (s.size === partRows.length) return new Set()
      return new Set(partRows.map((p) => p.rowKey))
    })
  }, [partRows])

  const pickStartRowIndex = useCallback(() => {
    const indices = partRows
      .map((p, i) => (selected.has(p.rowKey) ? i : -1))
      .filter((i) => i >= 0)
    if (indices.length) return Math.min(...indices)
    const { rowIndex } = pasteAnchorRef.current
    if (!partRows.length) return 0
    return Math.max(0, Math.min(rowIndex, partRows.length - 1))
  }, [partRows, selected])

  const weekPasteReadOnly = useCallback(
    (spec, col, plan) => {
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
    [asOfDate],
  )

  const runPlanMatrixPaste = useCallback(
    (matrix, anchor, startRowIdx) => {
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
        if (spec.kind === 'draft') {
          drafts = drafts.map((d) =>
            d.id === spec.draftId ? { ...d, modelName: newModel, partNo: newPart } : d,
          )
          spec.modelName = newModel
          spec.partNo = newPart
          return
        }
        if (spec.kind === 'plan') {
          plans = plans.map((pl) =>
            pl.modelName === oldM && pl.partNo === oldP
              ? { ...pl, modelName: newModel, partNo: newPart }
              : pl,
          )
          spec.modelName = newModel
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
          : formatKoEn(L.excelPasteDone),
      )
    },
    [deliveryPlans, draftRows, partRows, columns, weekPasteReadOnly],
  )

  const handlePasteFromExcel = useCallback(async () => {
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
    runPlanMatrixPaste(matrix, pasteAnchorRef.current, pickStartRowIndex())
  }, [runPlanMatrixPaste, pickStartRowIndex])

  const onDpNativePaste = useCallback(
    (matrix, cell) => {
      const row = Number.parseInt(String(cell.getAttribute('data-dp-row') ?? ''), 10)
      const kindRaw = cell.getAttribute('data-dp-kind') || 'week'
      const weekIdx = Number.parseInt(String(cell.getAttribute('data-dp-week-idx') ?? ''), 10)
      const kind =
        kindRaw === 'model' || kindRaw === 'part' || kindRaw === 'week' ? kindRaw : 'week'
      const anchor = {
        rowIndex: Number.isFinite(row) ? row : 0,
        colKind: kind,
        weekColIndex: Number.isFinite(weekIdx) ? weekIdx : 0,
      }
      pasteAnchorRef.current = anchor
      runPlanMatrixPaste(matrix, anchor, Number.isFinite(row) ? row : 0)
    },
    [runPlanMatrixPaste],
  )

  useGridNativePaste({ tableRef: dpTableRef, onPasteMatrix: onDpNativePaste })

  const handleCopyToExcel = useCallback(async () => {
    setExcelMsg('')
    const header = ['Model', 'Part No', ...columns.map((c) => c.headerShort ?? c.week ?? '')]
    const src = selected.size > 0 ? partRows.filter((p) => selected.has(p.rowKey)) : partRows
    const body = src.map((spec) => {
      const cells = [spec.modelName ?? '', spec.partNo ?? '']
      for (const col of columns) {
        const wk = weekStartFromCol(col)
        const pl = planByKey.get(`${spec.modelName}\t${spec.partNo}\t${wk}`)
        const q = pl?.qty
        cells.push(q != null && q !== '' ? String(q) : '')
      }
      return cells
    })
    await writeClipboardText(matrixToTsv([header, ...body]))
    setExcelMsg(formatKoEn(L.excelCopyDone))
  }, [partRows, selected, columns, planByKey])

  const handleClearSelected = useCallback(() => {
    if (!selected.size) return
    setDeliveryPlans((plans) => {
      let next = [...plans]
      for (const rk of selected) {
        const spec = partRows.find((p) => p.rowKey === rk)
        if (!spec || spec.kind === 'draft') continue
        next = next.filter((p) => !(p.modelName === spec.modelName && p.partNo === spec.partNo))
      }
      return next
    })
    setDraftRows((drafts) => drafts.filter((d) => !selected.has(`d:${d.id}`)))
    setSelected(new Set())
    setInvalidRowKeys(new Set())
    setExcelMsg('')
  }, [selected, partRows])

  const pastOptions = useMemo(
    () => Array.from({ length: MAX_PAST_WEEKS + 1 }, (_, i) => i),
    [],
  )

  return (
    <div className="page delivery-plan-page">
      <header className="page__header">
        <h1>
          <BilingualLabel label={L.deliveryPlanScreenTitle} compact as="span" />
        </h1>
        <p className="page__desc">
          <BilingualLabel label={L.deliveryPlanPageDesc} compact as="span" />
        </p>
        <p className="page__desc page__desc--secondary">
          <BilingualLabel label={L.deliveryPlanScreenSubtitle} compact as="span" />
        </p>
        <ExcelGridToolbar
          onPasteFromExcel={handlePasteFromExcel}
          onCopyToExcel={handleCopyToExcel}
          onClearSelected={handleClearSelected}
          selectedCount={selected.size}
          message={excelMsg}
        />
        <div className="delivery-plan-page__toolbar">
          <label>
            <BilingualLabel label={L.previousWeeksShown} compact as="span" />
            <select
              value={pastWeeks}
              onChange={(e) => setPastWeeks(Number(e.target.value))}
              aria-label={formatKoEn(L.previousWeeksShown)}
            >
              {pastOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <BilingualLabel label={L.futureWeeksShown} compact as="span" />
            <select
              value={futureWeeks}
              onChange={(e) => setFutureWeeks(Number(e.target.value))}
              aria-label={formatKoEn(L.futureWeeksShown)}
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
              className="btn btn--ghost"
              onClick={() => setWeekOffset((o) => o - 12)}
            >
              {formatKoEn(L.previous12Weeks)}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setWeekOffset((o) => o + 12)}
            >
              {formatKoEn(L.next12Weeks)}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setWeekOffset(0)
                setPastWeeks(DEFAULT_PAST)
                setFutureWeeks(DEFAULT_FUTURE)
              }}
            >
              {formatKoEn(L.currentBaseline)}
            </button>
          </div>
          <span className="page__hint" style={{ margin: 0 }}>
            {formatKoEn(L.opsQueryDateKst)}: <strong>{asOfDate}</strong> · {formatKoEn(L.columnsCount)}{' '}
            {columns.length} {formatKoEn(L.weeks)}
            {weekOffset !== 0
              ? ` · ${formatKoEn(L.viewOffsetWeeks)} ${weekOffset > 0 ? '+' : ''}${weekOffset} ${formatKoEn(L.weeks)}`
              : ''}
          </span>
          <div className="page__actions" style={{ marginLeft: 'auto' }}>
            <button type="button" className="btn btn--ghost" onClick={addDraftRow}>
              {formatKoEn(L.addSkuRow)}
            </button>
            <button type="button" className="btn btn--primary" onClick={handleSave}>
              {formatKoEn(L.save)}
            </button>
          </div>
        </div>
        {saveHint && (
          <p className="page__hint" role="status">
            <BilingualLabel label={L.savedToBrowserStorage} compact as="span" />
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
              <BilingualLabel label={L.deletePartPlansTitle} compact as="span" />
            </h2>
            <div className="dp-modal__body">
              <p>{L.deletePartPlansConfirm.ko}</p>
              <p className="dp-modal__body-en">{L.deletePartPlansConfirm.en}</p>
            </div>
            <div className="dp-modal__actions">
              <button type="button" className="btn btn--ghost" onClick={cancelDeletePartPlans}>
                {formatKoEn(L.actionCancel)}
              </button>
              <button type="button" className="btn btn--primary dp-btn-delete-confirm" onClick={confirmDeletePartPlans}>
                {formatKoEn(L.actionDelete)}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="dp-table-wrap page__table">
        <table ref={dpTableRef} className="dp-grid">
          <thead>
            <tr>
              <th className="cell--center" style={{ width: '2rem' }}>
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={partRows.length > 0 && selected.size === partRows.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="dp-th--sticky dp-col-model">
                <BilingualLabel label={L.model} compact as="span" />
              </th>
              <th className="dp-th--sticky-end dp-col-part">
                <BilingualLabel label={L.partNo} compact as="span" />
              </th>
              {columns.map((c) => {
                const wk = weekStartFromCol(c)
                return (
                  <th key={wk} className="dp-week-col" title={`${c.week} · ${wk}`}>
                    {c.headerShort}
                  </th>
                )
              })}
              <th className="dp-th-actions" scope="col" aria-label={formatKoEn(L.actionDelete)}>
                <BilingualLabel label={L.actionDelete} compact as="span" />
              </th>
            </tr>
          </thead>
          <tbody>
            {partRows.map((spec, rowIndex) => {
              const { modelName, partNo, rowKey, kind, draftId } = spec
              const cellDisabled =
                (kind === 'draft' && (!modelName || !partNo)) ||
                (kind === 'plan' && (!modelName || !partNo))
              const masterFrozen = kind === 'master'
              const canQuickRemoveDraft =
                kind === 'draft' && (!String(modelName || '').trim() || !String(partNo || '').trim())
              const showDeleteConfirm =
                kind === 'master' ||
                kind === 'plan' ||
                (kind === 'draft' && !canQuickRemoveDraft)
              const deleteDisabled =
                kind === 'draft' && canQuickRemoveDraft ? false : !modelName || !partNo

              return (
                <tr
                  key={rowKey}
                  className={invalidRowKeys.has(rowKey) ? 'row--excel-invalid' : undefined}
                >
                  <td className="cell--center">
                    <input
                      type="checkbox"
                      checked={selected.has(rowKey)}
                      onChange={() => toggleSelect(rowKey)}
                      aria-label="Select row"
                    />
                  </td>
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
                        placeholder={formatKoEn(L.model)}
                        data-excel-paste
                        data-dp-row={rowIndex}
                        data-dp-kind="model"
                        data-dp-week-idx={0}
                        onFocus={() => {
                          pasteAnchorRef.current = { rowIndex, colKind: 'model', weekColIndex: 0 }
                        }}
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
                      <input
                        className="dp-input"
                        value={partNo}
                        placeholder={formatKoEn(L.partNo)}
                        data-excel-paste
                        data-dp-row={rowIndex}
                        data-dp-kind="part"
                        data-dp-week-idx={0}
                        onFocus={() => {
                          pasteAnchorRef.current = { rowIndex, colKind: 'part', weekColIndex: 0 }
                        }}
                        onChange={(e) => updateDraft(draftId, { partNo: e.target.value })}
                      />
                    ) : (
                      <input
                        className="dp-input"
                        value={partNo}
                        placeholder={formatKoEn(L.partNo)}
                        data-excel-paste
                        data-dp-row={rowIndex}
                        data-dp-kind="part"
                        data-dp-week-idx={0}
                        onFocus={() => {
                          pasteAnchorRef.current = { rowIndex, colKind: 'part', weekColIndex: 0 }
                        }}
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
                  {columns.map((col, weekIdx) => {
                    const wk = weekStartFromCol(col)
                    const plan = planByKey.get(`${modelName}\t${partNo}\t${wk}`)
                    return (
                      <WeekCell
                        key={wk}
                        col={col}
                        plan={plan}
                        asOfDate={asOfDate}
                        disabled={cellDisabled}
                        rowIndex={rowIndex}
                        weekIdx={weekIdx}
                        onQtyChange={onQtyChange(modelName, partNo)}
                        onFocusAnchor={() => {
                          pasteAnchorRef.current = {
                            rowIndex,
                            colKind: 'week',
                            weekColIndex: weekIdx,
                          }
                        }}
                      />
                    )
                  })}
                  <td className="dp-td-actions">
                    <button
                      type="button"
                      className="btn btn--ghost dp-btn-delete-row"
                      disabled={deleteDisabled}
                      title={formatKoEn(L.actionDelete)}
                      aria-label={formatKoEn(L.actionDelete)}
                      onClick={() => {
                        if (deleteDisabled) return
                        if (showDeleteConfirm) requestDeleteRow(spec)
                        else removeDraft(draftId)
                      }}
                    >
                      {formatKoEn(L.actionDelete)}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
