import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { L, formatKoEn, formatKoEnInline } from '../../i18n/labels'
import { matrixFromClipboardText, copyGridSelectionAsTsv } from '../../utils/agGridClipboard'
import { downloadXlsxFromAoA } from '../../utils/excelFile'
import { parseBoolCell, parseDateForInput, parseQtyCell } from '../../utils/excelGridClipboard'
import { resolveReceiptDateForLedger } from '../../utils/inventoryAsOf'
import { isTransitRowReceived, TRANSIT_ROW_STATUS, transitRowIdKey } from '../../utils/inTransitStatus'
import useUnsavedDraft from '../../hooks/useUnsavedDraft'
import { cloneInTransitRows } from '../../utils/inTransitDraft'
import { sortInTransitRowsByEtdTc } from '../../utils/inTransitSort'
import { normalizeModel } from '../../utils/modelName'
import { newId } from '../../utils/newId'
import { formatKstDateTime, getKoreaCalendarDate } from '../../utils/timeZones'
import {
  parseShipmentScheduleExcel,
  ParseShipmentScheduleError,
} from '../../utils/parseShipmentScheduleExcel'
import { formatEtaWhDisplay } from '../../utils/transitDisplayFormat'
import { MOBILE_SIMPLE_LAYOUT_MQ } from '../../utils/mobileLayout'
import { inventoryRemoteSyncEnabled } from '../../utils/inventoryRemoteSync'
import PageDataToolbar from '../grid/PageDataToolbar.jsx'
import BilingualLabel from '../BilingualLabel'
import '../grid/tc-inv-ag-grid.css'
import '../logistics/ops.css'
import './pages.css'
import './InTransitPage.css'

const EMPTY_APPLIED = { model: '', partNo: '', container: '', delivery: '' }

/** Excel 붙여넣기 열 순서 (액션 열 제외) */
const TRANSIT_PASTE_FIELDS = [
  'containerNo',
  'modelName',
  'partNo',
  'qty',
  'etdTcTech',
  'etdPort',
  'etaPort',
  'etaWh',
  'deliveryLocation',
  'arrived',
  'remark',
  'tcTechNo',
]

function buildTransitPastePatch(field, raw) {
  const s = String(raw ?? '').trim()
  switch (field) {
    case 'containerNo':
      return { containerNo: s }
    case 'modelName':
      return { modelName: normalizeModel(s) }
    case 'partNo':
    case 'deliveryLocation':
    case 'remark':
    case 'tcTechNo':
      return { [field]: s }
    case 'qty': {
      if (s === '') return {}
      const p = parseQtyCell(raw)
      if (!p.ok) return {}
      return { qty: Math.max(0, p.value) }
    }
    case 'arrived':
      return { arrived: parseBoolCell(raw) }
    case 'etdTcTech':
    case 'etdPort':
    case 'etaPort': {
      if (s === '') return { [field]: '' }
      const iso = parseDateForInput(raw)
      return { [field]: iso || '' }
    }
    case 'etaWh': {
      if (s === '') return { etaWh: '' }
      const iso = parseDateForInput(raw)
      return { etaWh: iso || s }
    }
    default:
      return {}
  }
}

function lc(s) {
  return String(s ?? '').toLowerCase()
}

/** 배송지(Location) 구분용 — 운영 화면용 차분한 텍스트 톤 클래스 */
function deliveryLocationToneClass(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  const lower = s.toLowerCase()
  const usa = /\busa\b/i.test(s) || lower.includes('united states')
  if (!usa) return ''
  const noSpace = lower.replace(/\s+/g, '')
  const moses =
    noSpace.includes('moseslake') || lower.includes('moses lake') || lower.includes('moses-lake')
  const redmond = lower.includes('redmond')
  if (moses && !redmond) return 'transit-page__loc--moseslake'
  if (redmond) return 'transit-page__loc--redmond'
  return ''
}

function rowMatchesApplied(row, applied) {
  if (applied.model && !lc(row.modelName).includes(applied.model)) return false
  if (applied.partNo && !lc(row.partNo).includes(applied.partNo)) return false
  if (applied.container && !lc(row.containerNo).includes(applied.container)) return false
  if (applied.delivery && !lc(row.deliveryLocation).includes(applied.delivery)) return false
  return true
}

function useTransitMobileLayout() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_SIMPLE_LAYOUT_MQ).matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_SIMPLE_LAYOUT_MQ)
    const fn = () => setIsMobile(mq.matches)
    fn()
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return isMobile
}

/** @param {{ ko: string, en: string }} label */
function labelWithCount(label, n) {
  const s = String(n)
  return {
    ko: String(label.ko).replaceAll('{n}', s),
    en: String(label.en).replaceAll('{n}', s),
  }
}

function formatProcessedAt(iso) {
  if (!iso) return '—'
  try {
    return formatKstDateTime(new Date(iso))
  } catch {
    return String(iso)
  }
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
    transitStatus: TRANSIT_ROW_STATUS.IN_TRANSIT,
    receiptDate: '',
    receivedBy: '',
    receivedAtIso: '',
  }
}

/** @param {any[]} prev */
function applyTransitPasteFromDisplay(prev, matrix, dispRow, dispCol, appliedSearch) {
  const received = prev.filter((r) => isTransitRowReceived(r))
  let active = prev.filter((r) => !isTransitRowReceived(r))
  const displayed = active.filter((r) => rowMatchesApplied(r, appliedSearch))
  const updates = new Map()
  const newRows = []

  for (let r = 0; r < matrix.length; r++) {
    const rowIndex = dispRow + r
    let target = displayed[rowIndex]
    if (!target) {
      target = emptyRow()
      newRows.push(target)
      active = [...active, target]
      displayed.push(target)
    }
    const key = transitRowIdKey(target.id)
    let acc = updates.get(key) || {}
    for (let c = 0; c < matrix[r].length; c++) {
      const ci = dispCol + c
      if (ci >= TRANSIT_PASTE_FIELDS.length) break
      const field = TRANSIT_PASTE_FIELDS[ci]
      const patch = buildTransitPastePatch(field, matrix[r][c])
      acc = { ...acc, ...patch }
    }
    updates.set(key, acc)
  }

  const mergedActive = active.map((row) => {
    const k = transitRowIdKey(row.id)
    const p = updates.get(k)
    return p ? { ...row, ...p } : row
  })

  return [...mergedActive, ...received]
}

function TransitDeleteRenderer(props) {
  const ctx = props.context || {}
  return (
    <button
      type="button"
      className="btn btn--ghost btn--toolbar transit-page__btn-del"
      disabled={ctx.readOnly}
      onClick={() => ctx.onDeleteRow?.(props.data?.id)}
    >
      <BilingualLabel label={L.transitRowDelete} as="span" />
    </button>
  )
}

function TransitReceiptPickRenderer(props) {
  const ctx = props.context || {}
  const key = transitRowIdKey(props.data?.id)
  const checked = ctx.receiptCancelPickIds?.has?.(key) ?? false
  return (
    <input
      type="checkbox"
      disabled={ctx.readOnly}
      checked={checked}
      onChange={() => ctx.onTogglePick?.(props.data?.id)}
      aria-label={formatKoEnInline(L.receiptCancelPickRow)}
    />
  )
}

export default function InTransitPage({
  inTransit: savedInTransit,
  onPersistInTransit,
  registerUnsavedGuard,
  setMasterItems,
  masterItems = [],
  appendArrivalLedger,
  onApplyReceiptCancellation: applyReceiptCancellationProp,
  currentUserLabel = '',
  onRequestRemoteSync,
  readOnly = false,
}) {
  const applyReceiptCancellation =
    typeof applyReceiptCancellationProp === 'function' ? applyReceiptCancellationProp : null
  const [viewMode, setViewMode] = useState('active')
  const [saveHint, setSaveHint] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [excelMsg, setExcelMsg] = useState('')
  /** 입고 이력 탭에서만 사용: 입고 취소 버튼에 넘길 행 id */
  const [receiptCancelPickIds, setReceiptCancelPickIds] = useState(() => new Set())
  /** 클릭 핸들러에서 항상 최신 선택 id Set (배치·클로저 타이밍 이슈 방지) */
  const receiptCancelPickIdsRef = useRef(receiptCancelPickIds)
  const [addRowCount, setAddRowCount] = useState(1)
  const [searchModel, setSearchModel] = useState('')
  const [searchPartNo, setSearchPartNo] = useState('')
  const [searchContainer, setSearchContainer] = useState('')
  const [searchDelivery, setSearchDelivery] = useState('')
  const [appliedSearch, setAppliedSearch] = useState(() => ({ ...EMPTY_APPLIED }))
  const gridApiRef = useRef(null)
  const isMobileLayout = useTransitMobileLayout()

  const { draft, setDraft } = useUnsavedDraft({
    saved: savedInTransit,
    clone: cloneInTransitRows,
    registerUnsavedGuard,
    guardId: 'transit',
  })

  useLayoutEffect(() => {
    if (!isMobileLayout) return
    queueMicrotask(() => {
      setViewMode('active')
    })
  }, [isMobileLayout])

  const activeRows = useMemo(
    () => draft.filter((r) => !isTransitRowReceived(r)),
    [draft],
  )

  const historyRows = useMemo(
    () =>
      [...draft.filter((r) => isTransitRowReceived(r))].sort((a, b) =>
        String(b.receivedAtIso || '').localeCompare(String(a.receivedAtIso || '')),
      ),
    [draft],
  )

  const displayedActive = useMemo(
    () => activeRows.filter((r) => rowMatchesApplied(r, appliedSearch)),
    [activeRows, appliedSearch],
  )

  const displayedHistory = useMemo(
    () => historyRows.filter((r) => rowMatchesApplied(r, appliedSearch)),
    [historyRows, appliedSearch],
  )

  const displayedRows = viewMode === 'history' ? displayedHistory : displayedActive

  /** 연속 동일 컨테이너 No 구간 교차 배경 (대시보드 이번주 ETA와 동일 패턴) */
  const transitContainerBands = useMemo(() => {
    if (!displayedRows.length) return []
    let g = -1
    let prevKey = '__INIT__'
    return displayedRows.map((row) => {
      const key = String(row?.containerNo ?? '').trim() || '__MISSING__'
      if (prevKey === '__INIT__' || key !== prevKey) {
        g += 1
        prevKey = key
      }
      return g % 2 === 1
    })
  }, [displayedRows])

  const mobileReceiptCount = useMemo(
    () => displayedActive.filter((r) => r.arrived && !isTransitRowReceived(r)).length,
    [displayedActive],
  )

  useEffect(() => {
    receiptCancelPickIdsRef.current = receiptCancelPickIds
  }, [receiptCancelPickIds])

  useEffect(() => {
    const empty = new Set()
    receiptCancelPickIdsRef.current = empty
    queueMicrotask(() => {
      setReceiptCancelPickIds(empty)
      if (viewMode === 'history') {
        setExcelMsg('')
      }
    })
  }, [viewMode])

  function handleReceiptCancel() {
    if (readOnly) return
    const pickUnion = Array.from(
      new Set([
        ...Array.from(receiptCancelPickIds),
        ...Array.from(receiptCancelPickIdsRef.current),
      ]),
    )
    const cancelRows = pickUnion
      .map((id) => historyRows.find((r) => String(r.id) === String(id)))
      .filter(Boolean)

    if (!cancelRows.length) {
      window.alert(formatKoEnInline(L.receiptCancelNoneSelected))
      return
    }
    if (!applyReceiptCancellation) {
      window.alert(
        formatKoEnInline({
          ko: '입고 취소 기능이 연결되지 않았습니다. 앱을 새로고침하거나 관리자에게 문의하세요.',
          en: 'Receipt cancel is not wired. Refresh the app or contact an administrator.',
        }),
      )
      return
    }
    const insufficient = []
    for (const r of cancelRows) {
      const qty = Math.max(0, Number(r.qty) || 0)
      if (qty <= 0) continue
      const m = masterItems.find(
        (x) =>
          String(x.modelName ?? '').trim() === String(r.modelName ?? '').trim() &&
          String(x.partNo ?? '').trim() === String(r.partNo ?? '').trim(),
      )
      const stock = m ? Number(m.currentStock) || 0 : 0
      if (stock < qty) {
        insufficient.push(
          `${r.modelName} / ${r.partNo} — ${formatKoEnInline({
            ko: `요청 입고 ${qty} > 창고 ${stock}`,
            en: `receipt qty ${qty} > warehouse ${stock}`,
          })}`,
        )
      }
    }
    if (insufficient.length) {
      window.alert(
        `${formatKoEnInline(L.receiptCancelInsufficientStock)}\n\n${insufficient.join('\n')}`,
      )
      return
    }
    if (!window.confirm(formatKoEnInline(L.receiptCancelConfirm))) return
    try {
      applyReceiptCancellation(cancelRows, currentUserLabel)
      setDraft((prev) => {
        const cancelIds = new Set(cancelRows.map((r) => transitRowIdKey(r.id)))
        return prev.map((row) => {
          if (!cancelIds.has(transitRowIdKey(row.id))) return row
          return {
            ...row,
            transitStatus: TRANSIT_ROW_STATUS.IN_TRANSIT,
            arrived: false,
            receiptDate: null,
            receivedBy: '',
            receivedAtIso: null,
          }
        })
      })
    } catch (e) {
      console.error(e)
      window.alert(
        formatKoEnInline({
          ko: '입고 취소 처리 중 오류가 발생했습니다.',
          en: 'An error occurred while cancelling receipts.',
        }),
      )
      return
    }
    setReceiptCancelPickIds(new Set())
    receiptCancelPickIdsRef.current = new Set()
    setSaveHint(formatKoEn(L.receiptCancelSuccess))
    setTimeout(() => setSaveHint(''), 2500)
    if (typeof onRequestRemoteSync === 'function') {
      onRequestRemoteSync()
    }
  }

  const applyArrivedToRows = useCallback(
    (sourceRows, arrivedRows) => {
      const rows = (arrivedRows || []).filter((r) => r && r.arrived && !isTransitRowReceived(r))
      if (!rows.length) return sourceRows

      if (typeof appendArrivalLedger === 'function') {
        const koreaDay = getKoreaCalendarDate()
        const entries = rows
          .map((r) => ({
            id: newId('arr'),
            modelName: r.modelName,
            partNo: r.partNo,
            qty: Math.max(0, Number(r.qty) || 0),
            receivedAt: resolveReceiptDateForLedger(r, koreaDay),
            sourceTransitId: r.id,
          }))
          .filter((e) => e.qty > 0 && String(e.modelName).trim() && String(e.partNo).trim())
        if (entries.length) appendArrivalLedger(entries)
      }

      setMasterItems((master) => {
        const next = master.map((m) => ({ ...m }))
        for (const r of rows) {
          const qty = Number(r.qty) || 0
          if (qty <= 0) continue
          const ix = next.findIndex((x) => x.partNo === r.partNo && x.modelName === r.modelName)
          if (ix >= 0) {
            next[ix] = {
              ...next[ix],
              currentStock: (Number(next[ix].currentStock) || 0) + qty,
            }
          }
        }
        return next
      })

      const koreaDay = getKoreaCalendarDate()
      const nowIso = new Date().toISOString()
      const by = String(currentUserLabel || '').trim() || '—'
      const commitIds = new Set(rows.map((x) => transitRowIdKey(x.id)))

      return sourceRows.map((r) => {
        if (!commitIds.has(transitRowIdKey(r.id))) return r
        if (!r.arrived || isTransitRowReceived(r)) return r
        return {
          ...r,
          transitStatus: TRANSIT_ROW_STATUS.RECEIVED,
          receiptDate: resolveReceiptDateForLedger(r, koreaDay),
          receivedBy: by,
          receivedAtIso: nowIso,
        }
      })
    },
    [appendArrivalLedger, setMasterItems, currentUserLabel],
  )

  const persistDraft = useCallback(
    (rows) => {
      const sorted = sortInTransitRowsByEtdTc(rows)
      if (typeof onPersistInTransit === 'function') onPersistInTransit(sorted)
      setDraft(sorted)
      setSaveHint(
        formatKoEn(inventoryRemoteSyncEnabled() ? L.savedAfterEditWithRemote : L.savedToBrowserStorage),
      )
      setTimeout(() => setSaveHint(''), 2500)
      if (typeof onRequestRemoteSync === 'function') onRequestRemoteSync()
      return sorted
    },
    [onPersistInTransit, onRequestRemoteSync, setDraft],
  )

  function handleSave() {
    if (readOnly) return
    let next = [...draft]
    const arrived = next.filter((r) => r.arrived && !isTransitRowReceived(r))
    if (arrived.length) next = applyArrivedToRows(next, arrived)
    persistDraft(next)
  }

  function handleMobileInboundCommit() {
    if (readOnly) return
    const rows = displayedActive.filter((r) => r.arrived && !isTransitRowReceived(r))
    if (!rows.length) {
      window.alert(formatKoEnInline(L.mobileInboundNoneChecked))
      return
    }
    if (!window.confirm(formatKoEnInline(labelWithCount(L.mobileInboundConfirm, rows.length)))) return
    const next = applyArrivedToRows(draft, rows)
    persistDraft(next)
  }

  function applySearchFromForm() {
    setAppliedSearch({
      model: searchModel.trim().toLowerCase(),
      partNo: searchPartNo.trim().toLowerCase(),
      container: searchContainer.trim().toLowerCase(),
      delivery: searchDelivery.trim().toLowerCase(),
    })
  }

  function resetSearch() {
    setSearchModel('')
    setSearchPartNo('')
    setSearchContainer('')
    setSearchDelivery('')
    setAppliedSearch({ ...EMPTY_APPLIED })
  }

  const updateRow = useCallback(
    (id, patch) => {
      if (readOnly) return
      const key = transitRowIdKey(id)
      const next = { ...patch }
      if ('modelName' in next) next.modelName = normalizeModel(next.modelName)
      setDraft((rows) => rows.map((r) => (transitRowIdKey(r.id) === key ? { ...r, ...next } : r)))
    },
    [readOnly, setDraft],
  )

  function handleAdd() {
    if (readOnly) return
    const n = Math.max(1, Math.min(500, Math.floor(Number(addRowCount)) || 1))
    setAddRowCount(n)
    setDraft((rows) => {
      const extra = Array.from({ length: n }, () => emptyRow())
      return [...rows, ...extra]
    })
  }

  const requestDeleteRow = useCallback(
    (id) => {
      if (readOnly) return
      if (!window.confirm(formatKoEnInline(L.inTransitDeleteConfirm))) return
      const key = transitRowIdKey(id)
      setDraft((rows) => rows.filter((r) => transitRowIdKey(r.id) !== key))
      setReceiptCancelPickIds((s) => {
        const n = new Set(s)
        n.delete(key)
        receiptCancelPickIdsRef.current = n
        return n
      })
    },
    [readOnly, setDraft],
  )

  const toggleReceiptCancelPick = useCallback((id) => {
    if (readOnly) return
    const key = transitRowIdKey(id)
    setReceiptCancelPickIds((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      receiptCancelPickIdsRef.current = n
      return n
    })
  }, [readOnly])

  async function handleShipmentFile(ev) {
    if (readOnly) return
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return
    setUploadError('')
    try {
      const buffer = await file.arrayBuffer()
      const { rows, sheetName } = parseShipmentScheduleExcel(buffer)
      setDraft((prev) => [...prev, ...rows])
      setSaveHint(
        `“${sheetName}” 시트에서 ${rows.length}행 로드됨(저장 전 임시 반영 · Loaded ${rows.length} row(s), not saved yet)`,
      )
      setTimeout(() => setSaveHint(''), 4000)
      setExcelMsg(formatKoEn(L.excelUploadApplied))
      setTimeout(() => setExcelMsg(''), 3000)
    } catch (err) {
      setUploadError(
        err instanceof ParseShipmentScheduleError
          ? err.message
          : '업로드 처리 중 오류가 발생했습니다.',
      )
    }
  }

  function handleDownloadXlsx() {
    setExcelMsg('')
    if (viewMode === 'history') {
      const header = [
        'Container',
        'Model',
        'Part No',
        'Qty',
        'ETD TC TECH',
        'ETD Port',
        'ETA Port',
        'ETA W/H',
        'Delivery',
        'Receipt date',
        'Remark',
        'Received by',
        'Processed at (KST)',
      ]
      const body = displayedHistory.map((row) => [
        row.containerNo ?? '',
        row.modelName ?? '',
        row.partNo ?? '',
        String(row.qty ?? ''),
        row.etdTcTech ?? '',
        row.etdPort ?? '',
        row.etaPort ?? '',
        row.etaWh ?? '',
        row.deliveryLocation ?? '',
        row.receiptDate ?? '',
        row.remark ?? '',
        row.receivedBy ?? '',
        formatProcessedAt(row.receivedAtIso),
      ])
      downloadXlsxFromAoA('InTransitReceiptHistory', 'ReceiptHistory', [header, ...body])
    } else {
      const header = [
        'Container',
        'Model',
        'Part No',
        'Qty',
        'ETD TC TECH',
        'ETD Port',
        'ETA Port',
        'ETA W/H',
        'Delivery',
        'Arrived',
        'Remark',
        'TC TECH No.',
      ]
      const body = displayedActive.map((row) => [
        row.containerNo ?? '',
        row.modelName ?? '',
        row.partNo ?? '',
        String(row.qty ?? ''),
        row.etdTcTech ?? '',
        row.etdPort ?? '',
        row.etaPort ?? '',
        row.etaWh ?? '',
        row.deliveryLocation ?? '',
        row.arrived ? 'TRUE' : 'FALSE',
        row.remark ?? '',
        row.tcTechNo ?? '',
      ])
      downloadXlsxFromAoA('InTransitInventory', 'InTransit', [header, ...body])
    }
    setExcelMsg(formatKoEn(L.excelExportDone))
    setTimeout(() => setExcelMsg(''), 2500)
  }

  const isHistory = viewMode === 'history'

  const activeRowData = useMemo(
    () => displayedActive.map((row, i) => ({ ...row, __dispIdx: i })),
    [displayedActive],
  )

  const historyRowData = useMemo(
    () =>
      displayedHistory.map((row, i) => ({
        ...row,
        __dispIdx: i,
        etaWhDisplay: formatEtaWhDisplay(row.etaWh),
        receiptDateDisplay: row.receiptDate ?? '—',
        receivedAtDisplay: formatProcessedAt(row.receivedAtIso),
      })),
    [displayedHistory],
  )

  const transitHistoryCopyColIds = useMemo(
    () => [
      'containerNo',
      'modelName',
      'partNo',
      'qty',
      'etdTcTech',
      'etdPort',
      'etaPort',
      'etaWhDisplay',
      'deliveryLocation',
      'receiptDateDisplay',
      'remark',
      'receivedBy',
      'receivedAtDisplay',
    ],
    [],
  )

  const gridContextActive = useMemo(
    () => ({ readOnly, onDeleteRow: requestDeleteRow }),
    [readOnly, requestDeleteRow],
  )

  const gridContextHistory = useMemo(
    () => ({
      readOnly,
      receiptCancelPickIds,
      onTogglePick: toggleReceiptCancelPick,
    }),
    [readOnly, receiptCancelPickIds, toggleReceiptCancelPick],
  )

  const activeColumnDefs = useMemo(
    () => [
      {
        field: 'containerNo',
        headerName: formatKoEnInline(L.containerNo),
        editable: !readOnly,
        minWidth: 108,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'modelName',
        headerName: formatKoEnInline(L.model),
        editable: !readOnly,
        minWidth: 100,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'partNo',
        headerName: formatKoEnInline(L.partNo),
        editable: !readOnly,
        minWidth: 100,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'qty',
        headerName: formatKoEnInline(L.qty),
        editable: !readOnly,
        width: 88,
        filter: 'agNumberColumnFilter',
        floatingFilter: true,
        type: 'numericColumn',
      },
      {
        field: 'etdTcTech',
        headerName: formatKoEnInline(L.etdTcTech),
        editable: !readOnly,
        width: 132,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'etdPort',
        headerName: formatKoEnInline(L.etdPort),
        editable: !readOnly,
        width: 132,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'etaPort',
        headerName: formatKoEnInline(L.etaPort),
        editable: !readOnly,
        width: 132,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'etaWh',
        headerName: formatKoEnInline(L.etaWh),
        editable: !readOnly,
        width: 132,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'deliveryLocation',
        headerName: formatKoEnInline(L.deliveryLocation),
        editable: !readOnly,
        flex: 1,
        minWidth: 120,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
        cellClass: (p) => deliveryLocationToneClass(p.value),
      },
      {
        field: 'arrived',
        headerName: formatKoEnInline(L.arrived),
        editable: !readOnly,
        width: 92,
        cellRenderer: 'agCheckboxCellRenderer',
        filter: false,
      },
      {
        field: 'remark',
        headerName: formatKoEnInline(L.remark),
        editable: !readOnly,
        minWidth: 120,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'tcTechNo',
        headerName: formatKoEnInline(L.tcTechNo),
        editable: !readOnly,
        width: 110,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        colId: 'actions',
        headerName: formatKoEnInline(L.transitActionCol),
        width: 76,
        pinned: 'right',
        sortable: false,
        filter: false,
        floatingFilter: false,
        suppressMovable: true,
        cellRenderer: 'TransitDeleteRenderer',
      },
    ],
    [readOnly],
  )

  const historyColumnDefs = useMemo(
    () => [
      {
        field: 'containerNo',
        headerName: formatKoEnInline(L.containerNo),
        editable: false,
        minWidth: 100,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'modelName',
        headerName: formatKoEnInline(L.model),
        editable: false,
        minWidth: 96,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'partNo',
        headerName: formatKoEnInline(L.partNo),
        editable: false,
        minWidth: 96,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'qty',
        headerName: formatKoEnInline(L.qty),
        editable: false,
        width: 80,
        filter: 'agNumberColumnFilter',
        floatingFilter: true,
        type: 'numericColumn',
      },
      {
        field: 'etdTcTech',
        headerName: formatKoEnInline(L.etdTcTech),
        editable: false,
        width: 120,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'etdPort',
        headerName: formatKoEnInline(L.etdPort),
        editable: false,
        width: 120,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'etaPort',
        headerName: formatKoEnInline(L.etaPort),
        editable: false,
        width: 120,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'etaWhDisplay',
        headerName: formatKoEnInline(L.etaWh),
        editable: false,
        width: 120,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'deliveryLocation',
        headerName: formatKoEnInline(L.deliveryLocation),
        editable: false,
        flex: 1,
        minWidth: 110,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
        cellClass: (p) => deliveryLocationToneClass(p.value),
      },
      {
        colId: 'receiptCancelPick',
        headerName: formatKoEnInline(L.receiptCancelColumn),
        width: 56,
        sortable: false,
        filter: false,
        suppressMovable: true,
        cellRenderer: 'TransitReceiptPickRenderer',
      },
      {
        field: 'receiptDateDisplay',
        headerName: formatKoEnInline(L.receiptDateCol),
        editable: false,
        width: 112,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'remark',
        headerName: formatKoEnInline(L.remark),
        editable: false,
        minWidth: 100,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'receivedBy',
        headerName: formatKoEnInline(L.receivedByCol),
        editable: false,
        width: 100,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
      {
        field: 'receivedAtDisplay',
        headerName: formatKoEnInline(L.receivedAtCol),
        editable: false,
        width: 148,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
      },
    ],
    [],
  )

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      resizable: true,
      singleClickEdit: true,
    }),
    [],
  )

  const getRowId = useCallback((p) => transitRowIdKey(p.data?.id), [])

  const getRowClass = useCallback(
    (p) => (transitContainerBands[p.data?.__dispIdx] ? 'transit-page__row--band' : undefined),
    [transitContainerBands],
  )

  const onGridReady = useCallback((e) => {
    gridApiRef.current = e.api
  }, [])

  const onCellValueChanged = useCallback(
    (e) => {
      if (readOnly || isHistory) return
      const f = e.colDef?.field
      const id = e.data?.id
      if (!f || !id || f === '__dispIdx') return
      let v = e.newValue
      if (f === 'qty') v = Math.max(0, Number(v) || 0)
      else if (f === 'arrived') v = !!v
      else if (f === 'containerNo' || f === 'partNo' || f === 'remark' || f === 'tcTechNo') v = String(v ?? '')
      else if (f === 'modelName') v = normalizeModel(v)
      else if (f === 'etdTcTech' || f === 'etdPort' || f === 'etaPort' || f === 'etaWh') {
        const s = String(v ?? '').trim()
        v = s ? parseDateForInput(s) || s : ''
      } else if (f === 'deliveryLocation') v = String(v ?? '')
      updateRow(id, { [f]: v })
    },
    [readOnly, isHistory, updateRow],
  )

  const applyTransitClipboardPaste = useCallback(
    (api, text) => {
      if (readOnly || isHistory) return
      let matrix = matrixFromClipboardText(text)
      if (matrix.length && String(matrix[0]?.[0] ?? '').toLowerCase().includes('container')) {
        matrix = matrix.slice(1)
      }
      if (!matrix.length) return
      const cell = api.getFocusedCell()
      if (!cell) return
      const node = api.getDisplayedRowAtIndex(cell.rowIndex)
      if (!node?.data?.id) return
      const colId = cell.column.getColId()
      const pasteStartCol = TRANSIT_PASTE_FIELDS.includes(colId) ? TRANSIT_PASTE_FIELDS.indexOf(colId) : 0
      const dispRow = displayedActive.findIndex((r) => r.id === node.data.id)
      if (dispRow < 0) return
      setDraft((prev) => applyTransitPasteFromDisplay(prev, matrix, dispRow, pasteStartCol, appliedSearch))
      setExcelMsg(formatKoEn(L.excelUploadApplied))
      setTimeout(() => setExcelMsg(''), 2500)
    },
    [readOnly, isHistory, displayedActive, appliedSearch, setDraft],
  )

  const onCellKeyDown = useCallback(
    (e) => {
      const ev = e.event
      if (!(ev.ctrlKey || ev.metaKey)) return
      const k = String(ev.key || '').toLowerCase()
      if (k === 'c') {
        ev.preventDefault()
        const colIds = isHistory ? transitHistoryCopyColIds : TRANSIT_PASTE_FIELDS
        const tsv = copyGridSelectionAsTsv(e.api, colIds)
        if (tsv) void navigator.clipboard.writeText(tsv).catch(() => {})
        return
      }
      if (k === 'v' && !readOnly && !isHistory) {
        ev.preventDefault()
        void navigator.clipboard.readText().then((t) => applyTransitClipboardPaste(e.api, t))
      }
    },
    [readOnly, isHistory, transitHistoryCopyColIds, applyTransitClipboardPaste],
  )

  useLayoutEffect(() => {
    const api = gridApiRef.current
    if (!api || !isHistory) return
    api.refreshCells({ columns: ['receiptCancelPick'], force: true })
  }, [receiptCancelPickIds, isHistory])

  const transitTabBar = (
    <div className="transit-page__tabs transit-mobile__tabs" role="tablist" aria-label="In-transit views">
      <button
        type="button"
        role="tab"
        aria-selected={!isHistory}
        className={`transit-page__tab ${!isHistory ? 'transit-page__tab--active' : ''}`}
        onClick={() => setViewMode('active')}
      >
        <BilingualLabel label={L.transitTabActive} as="span" />
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={isHistory}
        className={`transit-page__tab ${isHistory ? 'transit-page__tab--active' : ''}`}
        onClick={() => setViewMode('history')}
      >
        <BilingualLabel label={L.transitTabHistory} as="span" />
      </button>
    </div>
  )

  const transitSearchForm = (
    <form
      className="page-search-strip page-search-strip--transit"
      onSubmit={(e) => {
        e.preventDefault()
        applySearchFromForm()
      }}
    >
      <div className="page-search-strip__fields">
        <span className="transit-page__search-title">
          <BilingualLabel label={L.transitSearchSection} as="span" />
        </span>
        <label className="page-search-strip__field">
          <span className="page-search-strip__label">
            <BilingualLabel label={L.transitSearchModel} as="span" />
          </span>
          <input
            className="cell-input"
            value={searchModel}
            onChange={(e) => setSearchModel(e.target.value)}
            aria-label={formatKoEnInline(L.transitSearchModel)}
          />
        </label>
        <label className="page-search-strip__field">
          <span className="page-search-strip__label">
            <BilingualLabel label={L.transitSearchPartNo} as="span" />
          </span>
          <input
            className="cell-input"
            value={searchPartNo}
            onChange={(e) => setSearchPartNo(e.target.value)}
            aria-label={formatKoEnInline(L.transitSearchPartNo)}
          />
        </label>
        <label className="page-search-strip__field">
          <span className="page-search-strip__label">
            <BilingualLabel label={L.transitSearchContainer} as="span" />
          </span>
          <input
            className="cell-input"
            value={searchContainer}
            onChange={(e) => setSearchContainer(e.target.value)}
            aria-label={formatKoEnInline(L.transitSearchContainer)}
          />
        </label>
        <label className="page-search-strip__field">
          <span className="page-search-strip__label">
            <BilingualLabel label={L.transitSearchDelivery} as="span" />
          </span>
          <input
            className="cell-input"
            value={searchDelivery}
            onChange={(e) => setSearchDelivery(e.target.value)}
            aria-label={formatKoEnInline(L.transitSearchDelivery)}
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
  )

  return (
    <div
      className={`page page--transit-compact${isMobileLayout ? ' page--transit-mobile-root' : ''}`}
    >
      {!isMobileLayout ? (
        <>
          <header className="page__header">
        <div className="page__header--row">
          <div style={{ flex: '1 1 100%' }}>
            <h1 className="transit-page__title">
              <BilingualLabel label={L.inTransitInventoryScreen} as="span" />
            </h1>
            <p className="page__desc">
              <span className="page__desc-line">
                <BilingualLabel label={L.inTransitSubtitle} as="span" />
              </span>{' '}
              <span className="page__desc-line">
                ETA 지연 행은 강조됩니다. Excel 시트 <strong>ML and Redmond</strong> 업로드로 일괄
                반영할 수 있습니다.
              </span>
            </p>
            {readOnly ? (
              <p className="page__hint page__hint--info" role="status">
                <BilingualLabel label={L.partnerReadOnlyInventory} as="span" />
              </p>
            ) : null}
            {transitTabBar}
            <PageDataToolbar
              hideUpload={isHistory || readOnly}
              onUploadChange={handleShipmentFile}
              onDownload={handleDownloadXlsx}
              downloadDisabled={
                viewMode === 'history' ? displayedHistory.length === 0 : displayedActive.length === 0
              }
              onSave={handleSave}
              hideSave={isHistory}
              saveDisabled={readOnly && !isHistory}
              message={uploadError ? `!${uploadError}` : excelMsg}
              extra={
                isHistory ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--toolbar"
                    disabled={readOnly || receiptCancelPickIds.size === 0}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleReceiptCancel()
                    }}
                  >
                    <BilingualLabel label={L.receiptCancelButton} as="span" />
                  </button>
                ) : (
                  <div className="transit-page__toolbar-add-group">
                    <label className="transit-page__add-rows transit-page__add-rows--toolbar">
                      <span className="transit-page__add-rows-label">
                        <BilingualLabel
                          label={L.transitRowsToAdd}
                          as="span"
                          compact
                          className="transit-page__add-rows-bilingual"
                        />
                      </span>
                      <input
                        type="number"
                        className="cell-input transit-page__add-rows-input"
                        min={1}
                        max={500}
                        step={1}
                        disabled={readOnly}
                        value={addRowCount}
                        onChange={(e) =>
                          setAddRowCount(
                            Math.max(1, Math.min(500, Math.floor(Number(e.target.value)) || 1)),
                          )
                        }
                        aria-label={formatKoEnInline(L.transitRowsToAdd)}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn--ghost btn--toolbar"
                      disabled={readOnly}
                      onClick={handleAdd}
                    >
                      <BilingualLabel label={L.transitAddRowsButton} as="span" />
                    </button>
                  </div>
                )
              }
              searchSlot={transitSearchForm}
            />
          </div>
        </div>
        {saveHint && (
          <p className="page__hint" role="status">
            {saveHint}
          </p>
        )}
      </header>

      <div className="transit-page__table-wrap page__table transit-page__ag-wrap">
        {isHistory && displayedHistory.length === 0 ? (
          <p className="transit-page__empty" style={{ padding: '1rem' }}>
            <BilingualLabel label={L.transitHistoryEmpty} as="span" />
          </p>
        ) : (
          <div className="ag-theme-quartz tc-inv-ag-shell tc-inv-ag-shell--fill">
            <AgGridReact
              key={viewMode}
              rowData={isHistory ? historyRowData : activeRowData}
              columnDefs={isHistory ? historyColumnDefs : activeColumnDefs}
              defaultColDef={defaultColDef}
              getRowId={getRowId}
              context={isHistory ? gridContextHistory : gridContextActive}
              components={{
                TransitDeleteRenderer,
                TransitReceiptPickRenderer,
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
              onCellValueChanged={onCellValueChanged}
              onCellKeyDown={onCellKeyDown}
              stopEditingWhenCellsLoseFocus
              animateRows
            />
          </div>
        )}
      </div>
      </>
    ) : (
      <div className="transit-mobile">
        <div className="transit-mobile__fixed-top">
          <h1 className="transit-mobile__title">
            <BilingualLabel label={L.inTransitInventoryScreen} as="span" compact />
          </h1>
          <div className="transit-mobile__search-anchor">{transitSearchForm}</div>
          <p className="transit-mobile__hint">
            <BilingualLabel label={L.mobileInboundHint} as="span" compact />
          </p>
          {(uploadError || excelMsg) && (
            <p
              className={
                uploadError
                  ? 'transit-mobile__banner transit-mobile__banner--error'
                  : 'transit-mobile__banner'
              }
              role={uploadError ? 'alert' : 'status'}
            >
              {uploadError || excelMsg}
            </p>
          )}
        </div>

        <div className="transit-mobile__scroll">
          {saveHint && (
            <p className="transit-mobile__status page__hint" role="status">
              {saveHint}
            </p>
          )}
          {displayedActive.length === 0 ? (
            <p className="transit-mobile__empty">
              <BilingualLabel label={L.mobileInboundEmpty} as="span" />
            </p>
          ) : (
            <ul className="transit-mobile__list">
              {displayedActive.map((row) => (
                <li key={row.id} className="transit-mobile__card">
                  <div className="transit-mobile__card-top">
                    <span className="transit-mobile__mono">{row.containerNo || '—'}</span>
                    <span className="transit-mobile__model">{row.modelName || ''}</span>
                  </div>
                  <dl className="transit-mobile__dl">
                    <div>
                      <dt>
                        <BilingualLabel label={L.partNo} as="span" />
                      </dt>
                      <dd>
                        <code>{row.partNo || ''}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>
                        <BilingualLabel label={L.qty} as="span" />
                      </dt>
                      <dd>{row.qty ?? 0}</dd>
                    </div>
                    <div>
                      <dt>
                        <BilingualLabel label={L.etaWh} as="span" />
                      </dt>
                      <dd>{formatEtaWhDisplay(row.etaWh) || '—'}</dd>
                    </div>
                    <div>
                      <dt>
                        <BilingualLabel label={L.deliveryLocation} as="span" />
                      </dt>
                      <dd className={deliveryLocationToneClass(row.deliveryLocation)}>
                        {row.deliveryLocation || '—'}
                      </dd>
                    </div>
                  </dl>
                  {row.remark ? (
                    <p className="transit-mobile__remark">
                      <span className="transit-mobile__remark-label">
                        <BilingualLabel label={L.remark} as="span" />
                        {': '}
                      </span>
                      {row.remark}
                    </p>
                  ) : null}
                  <label className="transit-mobile__arrived">
                    <input
                      type="checkbox"
                      className="transit-mobile__arrived-input"
                      disabled={readOnly}
                      checked={!!row.arrived}
                      onChange={(e) => updateRow(row.id, { arrived: e.target.checked })}
                    />
                    <span className="transit-mobile__arrived-label">
                      <BilingualLabel label={L.arrived} as="span" />
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="transit-mobile__fixed-bottom">
          <button
            type="button"
            className="btn btn--primary transit-mobile__commit"
            disabled={readOnly || mobileReceiptCount === 0}
            onClick={handleMobileInboundCommit}
          >
            <span className="transit-mobile__commit-inner">
              {formatKoEnInline(
                labelWithCount(L.mobileInboundProcessButton, mobileReceiptCount),
              )}
            </span>
          </button>
        </div>
      </div>
    )}
    </div>
  )
}
