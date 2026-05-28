import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { L, formatKoEn, formatKoEnInline } from '../../i18n/labels'
import useGridNativePaste from '../../hooks/useGridNativePaste'
import { downloadXlsxFromAoA } from '../../utils/excelFile'
import { parseBoolCell, parseDateForInput, parseQtyCell } from '../../utils/excelGridClipboard'
import { resolveReceiptDateForLedger } from '../../utils/inventoryAsOf'
import { isTransitRowReceived, TRANSIT_ROW_STATUS, transitRowIdKey } from '../../utils/inTransitStatus'
import { normalizeModel } from '../../utils/modelName'
import { newId } from '../../utils/newId'
import { formatKstDateTime, getKoreaCalendarDate } from '../../utils/timeZones'
import {
  parseShipmentScheduleExcel,
  ParseShipmentScheduleError,
} from '../../utils/parseShipmentScheduleExcel'
import { MOBILE_SIMPLE_LAYOUT_MQ } from '../../utils/mobileLayout'
import { inventoryRemoteSyncEnabled } from '../../utils/inventoryRemoteSync'
import PageDataToolbar from '../grid/PageDataToolbar.jsx'
import BilingualLabel from '../BilingualLabel'
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

/** ETA W/H·이력: 가능하면 항상 YYYY-MM-DD로 표시 */
function formatEtaWhDisplay(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  const iso = parseDateForInput(s)
  return iso || s
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

export default function InTransitPage({
  inTransit,
  setInTransit,
  setMasterItems,
  masterItems = [],
  appendArrivalLedger,
  onApplyReceiptCancellation: applyReceiptCancellationProp,
  currentUserLabel = '',
  onRequestRemoteSync,
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
  const transitTableRef = useRef(null)
  const isMobileLayout = useTransitMobileLayout()

  useLayoutEffect(() => {
    if (!isMobileLayout) return
    queueMicrotask(() => {
      setViewMode('active')
    })
  }, [isMobileLayout])

  const activeRows = useMemo(
    () => inTransit.filter((r) => !isTransitRowReceived(r)),
    [inTransit],
  )

  const historyRows = useMemo(
    () =>
      [...inTransit.filter((r) => isTransitRowReceived(r))].sort((a, b) =>
        String(b.receivedAtIso || '').localeCompare(String(a.receivedAtIso || '')),
      ),
    [inTransit],
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

  const commitArrivedRows = useCallback(
    (arrivedRows) => {
      const rows = (arrivedRows || []).filter((r) => r && r.arrived && !isTransitRowReceived(r))
      if (!rows.length) return

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

      setInTransit((prev) =>
        prev.map((r) => {
          if (!rows.some((x) => transitRowIdKey(x.id) === transitRowIdKey(r.id))) return r
          if (!r.arrived || isTransitRowReceived(r)) return r
          return {
            ...r,
            transitStatus: TRANSIT_ROW_STATUS.RECEIVED,
            receiptDate: resolveReceiptDateForLedger(r, koreaDay),
            receivedBy: by,
            receivedAtIso: nowIso,
          }
        }),
      )

      setSaveHint(
        formatKoEn(inventoryRemoteSyncEnabled() ? L.savedAfterEditWithRemote : L.savedToBrowserStorage),
      )
      setTimeout(() => setSaveHint(''), 2500)
      if (typeof onRequestRemoteSync === 'function') {
        onRequestRemoteSync()
      }
    },
    [appendArrivalLedger, setMasterItems, setInTransit, currentUserLabel, onRequestRemoteSync],
  )

  function handleSave() {
    commitArrivedRows(inTransit.filter((r) => r.arrived && !isTransitRowReceived(r)))
  }

  function handleMobileInboundCommit() {
    const rows = displayedActive.filter((r) => r.arrived && !isTransitRowReceived(r))
    if (!rows.length) {
      window.alert(formatKoEnInline(L.mobileInboundNoneChecked))
      return
    }
    if (!window.confirm(formatKoEnInline(labelWithCount(L.mobileInboundConfirm, rows.length)))) return
    commitArrivedRows(rows)
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

  function updateRow(id, patch) {
    const key = transitRowIdKey(id)
    const next = { ...patch }
    if ('modelName' in next) next.modelName = normalizeModel(next.modelName)
    setInTransit((rows) => rows.map((r) => (transitRowIdKey(r.id) === key ? { ...r, ...next } : r)))
  }

  function handleAdd() {
    const n = Math.max(1, Math.min(500, Math.floor(Number(addRowCount)) || 1))
    setAddRowCount(n)
    setInTransit((rows) => {
      const extra = Array.from({ length: n }, () => emptyRow())
      return [...rows, ...extra]
    })
  }

  function requestDeleteRow(id) {
    if (!window.confirm(formatKoEnInline(L.inTransitDeleteConfirm))) return
    const key = transitRowIdKey(id)
    setInTransit((rows) => rows.filter((r) => transitRowIdKey(r.id) !== key))
    setReceiptCancelPickIds((s) => {
      const n = new Set(s)
      n.delete(key)
      receiptCancelPickIdsRef.current = n
      return n
    })
  }

  const toggleReceiptCancelPick = useCallback((id) => {
    const key = transitRowIdKey(id)
    setReceiptCancelPickIds((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      receiptCancelPickIdsRef.current = n
      return n
    })
  }, [])

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

  const onTransitPasteMatrix = useCallback(
    (matrix, cell) => {
      const dispRow = Number(cell.dataset.excelRow)
      const dispCol = Number(cell.dataset.excelCol)
      if (!Number.isFinite(dispRow) || !Number.isFinite(dispCol)) return
      let m = matrix
      if (m.length && String(m[0]?.[0] ?? '').toLowerCase().includes('container')) {
        m = m.slice(1)
      }
      if (!m.length) return

      setInTransit((prev) => {
        const activeRows = prev.filter((r) => !isTransitRowReceived(r))
        const displayed = activeRows.filter((r) => rowMatchesApplied(r, appliedSearch))
        const updates = new Map()

        for (let r = 0; r < m.length; r++) {
          const target = displayed[dispRow + r]
          if (!target) break
          const key = transitRowIdKey(target.id)
          let acc = updates.get(key) || {}
          for (let c = 0; c < m[r].length; c++) {
            const ci = dispCol + c
            if (ci >= TRANSIT_PASTE_FIELDS.length) break
            const field = TRANSIT_PASTE_FIELDS[ci]
            const patch = buildTransitPastePatch(field, m[r][c])
            acc = { ...acc, ...patch }
          }
          updates.set(key, acc)
        }

        return prev.map((row) => {
          const k = transitRowIdKey(row.id)
          const p = updates.get(k)
          return p ? { ...row, ...p } : row
        })
      })
    },
    [appliedSearch, setInTransit],
  )

  useGridNativePaste({
    tableRef: transitTableRef,
    enabled: !isMobileLayout && !isHistory,
    onPasteMatrix: onTransitPasteMatrix,
  })

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
            {transitTabBar}
            <PageDataToolbar
              hideUpload={isHistory}
              onUploadChange={handleShipmentFile}
              onDownload={handleDownloadXlsx}
              downloadDisabled={
                viewMode === 'history' ? displayedHistory.length === 0 : displayedActive.length === 0
              }
              onSave={handleSave}
              hideSave={isHistory}
              message={uploadError ? `!${uploadError}` : excelMsg}
              extra={
                isHistory ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--toolbar"
                    disabled={receiptCancelPickIds.size === 0}
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
                        value={addRowCount}
                        onChange={(e) =>
                          setAddRowCount(
                            Math.max(1, Math.min(500, Math.floor(Number(e.target.value)) || 1)),
                          )
                        }
                        aria-label={formatKoEnInline(L.transitRowsToAdd)}
                      />
                    </label>
                    <button type="button" className="btn btn--ghost btn--toolbar" onClick={handleAdd}>
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

      <div className="transit-page__table-wrap page__table">
        {!isHistory ? (
          <table ref={transitTableRef} className="transit-page__table">
            <colgroup>
              <col className="transit-page__col--container" />
              <col className="transit-page__col--model" />
              <col className="transit-page__col--part" />
              <col className="transit-page__col--qty" />
              <col className="transit-page__col--date" />
              <col className="transit-page__col--date" />
              <col className="transit-page__col--date" />
              <col className="transit-page__col--date-eta-wh" />
              <col className="transit-page__col--delivery" />
              <col className="transit-page__col--arrived" />
              <col className="transit-page__col--remark" />
              <col className="transit-page__col--tctech" />
              <col className="transit-page__col--actions" />
            </colgroup>
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
                  <BilingualLabel label={L.tcTechNo} />
                </th>
                <th>
                  <BilingualLabel label={L.transitActionCol} />
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((row, rowIdx) => (
                <tr
                  key={row.id}
                  className={transitContainerBands[rowIdx] ? 'transit-page__row--band' : ''}
                >
                  <td>
                    <input
                      className="cell-input"
                      data-excel-paste
                      data-excel-row={rowIdx}
                      data-excel-col={0}
                      value={row.containerNo}
                      onChange={(e) => updateRow(row.id, { containerNo: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input"
                      data-excel-paste
                      data-excel-row={rowIdx}
                      data-excel-col={1}
                      value={row.modelName}
                      onChange={(e) => updateRow(row.id, { modelName: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input"
                      data-excel-paste
                      data-excel-row={rowIdx}
                      data-excel-col={2}
                      value={row.partNo}
                      onChange={(e) => updateRow(row.id, { partNo: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input cell-input--num"
                      data-excel-paste
                      data-excel-row={rowIdx}
                      data-excel-col={3}
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
                      data-excel-col={4}
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
                      data-excel-col={5}
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
                      data-excel-col={6}
                      type="date"
                      value={row.etaPort || ''}
                      onChange={(e) => updateRow(row.id, { etaPort: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input cell-input--date cell-input--date-eta-wh"
                      data-excel-paste
                      data-excel-row={rowIdx}
                      data-excel-col={7}
                      type="date"
                      lang="en-CA"
                      value={row.etaWh || ''}
                      onChange={(e) => updateRow(row.id, { etaWh: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className={`cell-input ${deliveryLocationToneClass(row.deliveryLocation)}`.trim()}
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
                      title={formatKoEnInline(L.transitArrivedSaveHint)}
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
                      <BilingualLabel label={L.transitRowDelete} as="span" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table ref={transitTableRef} className="transit-page__table transit-page__table--history">
            <colgroup>
              <col className="transit-page__col--container" />
              <col className="transit-page__col--model" />
              <col className="transit-page__col--part" />
              <col className="transit-page__col--qty" />
              <col className="transit-page__col--date" />
              <col className="transit-page__col--date" />
              <col className="transit-page__col--date" />
              <col className="transit-page__col--date-eta-wh" />
              <col className="transit-page__col--delivery" />
              <col className="transit-page__col--arrived" />
              <col className="transit-page__col--date" />
              <col className="transit-page__col--remark" />
              <col className="transit-page__col--meta" />
              <col className="transit-page__col--meta-wide" />
            </colgroup>
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
                <th className="cell--center">
                  <BilingualLabel label={L.receiptCancelColumn} />
                </th>
                <th>
                  <BilingualLabel label={L.receiptDateCol} />
                </th>
                <th>
                  <BilingualLabel label={L.remark} />
                </th>
                <th>
                  <BilingualLabel label={L.receivedByCol} />
                </th>
                <th>
                  <BilingualLabel label={L.receivedAtCol} />
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="transit-page__empty">
                    <BilingualLabel label={L.transitHistoryEmpty} as="span" />
                  </td>
                </tr>
              ) : (
                displayedRows.map((row, rowIdx) => (
                  <tr
                    key={row.id}
                    className={transitContainerBands[rowIdx] ? 'transit-page__row--band' : undefined}
                  >
                    <td className="transit-page__cell-readonly">{row.containerNo ?? ''}</td>
                    <td className="transit-page__cell-readonly">{row.modelName ?? ''}</td>
                    <td className="transit-page__cell-readonly">
                      <code>{row.partNo ?? ''}</code>
                    </td>
                    <td className="transit-page__cell-readonly cell--num">
                      {row.qty ?? ''}
                    </td>
                    <td className="transit-page__cell-readonly">{row.etdTcTech ?? ''}</td>
                    <td className="transit-page__cell-readonly">{row.etdPort ?? ''}</td>
                    <td className="transit-page__cell-readonly">{row.etaPort ?? ''}</td>
                    <td className="transit-page__cell-readonly">{formatEtaWhDisplay(row.etaWh)}</td>
                    <td
                      className={`transit-page__cell-readonly ${deliveryLocationToneClass(
                        row.deliveryLocation,
                      )}`.trim()}
                    >
                      {row.deliveryLocation ?? ''}
                    </td>
                    <td className="cell--center">
                      <input
                        type="checkbox"
                        checked={receiptCancelPickIds.has(transitRowIdKey(row.id))}
                        onChange={() => toggleReceiptCancelPick(row.id)}
                        aria-label={formatKoEnInline(L.receiptCancelPickRow)}
                      />
                    </td>
                    <td className="transit-page__cell-readonly">{row.receiptDate ?? '—'}</td>
                    <td className="transit-page__cell-readonly transit-page__td--remark">
                      {row.remark ?? ''}
                    </td>
                    <td className="transit-page__cell-readonly">{row.receivedBy ?? '—'}</td>
                    <td className="transit-page__cell-readonly transit-page__cell--mono">
                      {formatProcessedAt(row.receivedAtIso)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
            disabled={mobileReceiptCount === 0}
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
