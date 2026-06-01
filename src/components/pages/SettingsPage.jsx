import { useCallback, useMemo, useRef, useState } from 'react'
import { operationsMeta as defaultOps } from '../../data/logisticsSampleData'
import { L, formatKoEn, formatKoEnInline } from '../../i18n/labels'
import { saveJson, storageKeys } from '../../utils/appPersistence'
import { skuCostKey } from '../../utils/unitCostKrw'
import { parseQtyCell } from '../../utils/excelGridClipboard'
import { downloadXlsxFromAoA, readXlsxFirstSheetMatrix } from '../../utils/excelFile'
import { useMobileSimpleLayout } from '../../utils/mobileLayout'
import PageDataToolbar from '../grid/PageDataToolbar.jsx'
import BilingualLabel from '../BilingualLabel'
import UserManagementPage from './UserManagementPage.jsx'
import '../logistics/ops.css'
import './pages.css'

const EMPTY_COST_SEARCH = { model: '', part: '' }

function lc(s) {
  return String(s ?? '').toLowerCase()
}

function rowMatchesCostSearch(row, applied) {
  if (applied.model && !lc(row.modelName).includes(applied.model)) return false
  if (applied.part && !lc(row.partNo).includes(applied.part)) return false
  return true
}

export default function SettingsPage({
  opsMeta,
  setOpsMeta,
  onResetAllData,
  onDownloadAppDataBackup,
  onImportAppDataBackup,
  isAdmin = false,
  users,
  setUsers,
  currentUserId,
  onForceAuthReset,
  onNavigateView,
  masterItems = [],
  unitCostKrwBySku = {},
  setUnitCostKrwBySku,
  remoteSync = {
    enabled: false,
    meta: {},
    busyPull: false,
    busyPush: false,
    error: '',
    lastOk: '',
    onPull: async () => {},
    onPush: async () => {},
  },
}) {
  const isMobile = useMobileSimpleLayout()
  function patch(field, value) {
    setOpsMeta((o) => ({ ...o, [field]: value }))
  }

  const skuRowsForCost = useMemo(() => {
    const seen = new Set()
    const rows = []
    for (const m of masterItems) {
      if (m.status === 'Inactive') continue
      const model = String(m.modelName ?? '').trim()
      const part = String(m.partNo ?? '').trim()
      if (!model || !part) continue
      const k = skuCostKey(model, part)
      if (seen.has(k)) continue
      seen.add(k)
      rows.push({ id: m.id, modelName: model, partNo: part, mapKey: k })
    }
    rows.sort((a, b) =>
      a.modelName !== b.modelName
        ? a.modelName.localeCompare(b.modelName)
        : a.partNo.localeCompare(b.partNo),
    )
    return rows
  }, [masterItems])

  const [excelMsg, setExcelMsg] = useState('')
  const [selectedCost, setSelectedCost] = useState(() => new Set())
  const [invalidCostKeys, setInvalidCostKeys] = useState(() => new Set())
  const [searchCostModel, setSearchCostModel] = useState('')
  const [searchCostPart, setSearchCostPart] = useState('')
  const [appliedCostSearch, setAppliedCostSearch] = useState(() => ({ ...EMPTY_COST_SEARCH }))
  const unitCostTableRef = useRef(null)
  const importBackupInputRef = useRef(null)

  const displayedSkuRows = useMemo(
    () => skuRowsForCost.filter((r) => rowMatchesCostSearch(r, appliedCostSearch)),
    [skuRowsForCost, appliedCostSearch],
  )

  const toggleCostSelect = useCallback((mapKey) => {
    setSelectedCost((s) => {
      const n = new Set(s)
      if (n.has(mapKey)) n.delete(mapKey)
      else n.add(mapKey)
      return n
    })
  }, [])

  const toggleCostSelectAll = useCallback(() => {
    setSelectedCost((s) => {
      if (s.size === displayedSkuRows.length && displayedSkuRows.length > 0) return new Set()
      return new Set(displayedSkuRows.map((r) => r.mapKey))
    })
  }, [displayedSkuRows])

  const applyUnitCostMatrix = useCallback(
    (matrix, startRowIdx) => {
      if (typeof setUnitCostKrwBySku !== 'function') return
      setExcelMsg('')
      setInvalidCostKeys(new Set())
      const errs = []
      const bad = new Set()

      setUnitCostKrwBySku((prev) => {
        const next = { ...(prev || {}) }
        for (let r = 0; r < matrix.length; r++) {
          const rowIdx = startRowIdx + r
          if (rowIdx >= skuRowsForCost.length) break
          const sku = skuRowsForCost[rowIdx]
          const cells = matrix[r]
          let costRaw = cells[0]
          if (cells.length >= 3) {
            const cModel = String(cells[0] ?? '').trim()
            const cPart = String(cells[1] ?? '').trim()
            costRaw = cells[2]
            if (cModel && cPart && skuCostKey(cModel, cPart) !== sku.mapKey) {
              errs.push(`R${r + 1}: Model/Part does not match screen row ${rowIdx + 1}`)
              bad.add(sku.mapKey)
            }
          } else if (cells.length === 2) {
            costRaw = cells[1]
            const cPart = String(cells[0] ?? '').trim()
            if (cPart && cPart !== sku.partNo) {
              errs.push(`R${r + 1}: Part does not match row`)
              bad.add(sku.mapKey)
            }
          }
          const pq = parseQtyCell(costRaw ?? '')
          if (!pq.ok) {
            errs.push(`R${r + 1}: KRW not a number`)
            bad.add(sku.mapKey)
            continue
          }
          if (pq.empty) {
            delete next[sku.mapKey]
          } else {
            next[sku.mapKey] = Math.max(0, Math.round(pq.value))
          }
        }
        return next
      })

      setInvalidCostKeys(bad)
      setExcelMsg(errs.length ? `!${errs.slice(0, 6).join('\n')}` : formatKoEn(L.excelUploadApplied))
    },
    [skuRowsForCost, setUnitCostKrwBySku],
  )

  async function handleUnitCostUpload(ev) {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file || typeof setUnitCostKrwBySku !== 'function') return
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
      applyUnitCostMatrix(matrix, 0)
      setTimeout(() => setExcelMsg(''), 3500)
    } catch (err) {
      setExcelMsg(`!${String(err?.message || err)}`)
    }
  }

  function handleUnitCostDownload() {
    setExcelMsg('')
    const header = ['Model', 'Part No', 'Unit cost (KRW)']
    const body = displayedSkuRows.map((row) => [
      row.modelName,
      row.partNo,
      unitCostKrwBySku[row.mapKey] == null ? '' : String(unitCostKrwBySku[row.mapKey]),
    ])
    downloadXlsxFromAoA('SettingsUnitCost', 'UnitCost', [header, ...body])
    setExcelMsg(formatKoEn(L.excelExportDone))
    setTimeout(() => setExcelMsg(''), 2500)
  }

  function handleUnitCostSave() {
    if (typeof setUnitCostKrwBySku !== 'function') return
    saveJson(storageKeys.unitCostsKrw, unitCostKrwBySku)
    setExcelMsg(formatKoEn(remoteSync.enabled ? L.savedAfterEditWithRemote : L.savedToBrowserStorage))
    setTimeout(() => setExcelMsg(''), 2500)
  }

  function handleImportBackupFile(ev) {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file || typeof onImportAppDataBackup !== 'function') return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? ''))
        if (!window.confirm(formatKoEnInline(L.settingsDataImportConfirm))) return
        onImportAppDataBackup(parsed)
        window.alert(formatKoEn(L.settingsDataImportDone))
      } catch {
        window.alert(formatKoEn(L.settingsDataImportParseError))
      }
    }
    reader.onerror = () => window.alert(formatKoEn(L.settingsDataImportParseError))
    reader.readAsText(file, 'UTF-8')
  }

  return (
    <div className="page">
      <header className="page__header page__header--row">
        <div>
          <h1>
            <BilingualLabel label={L.settingsScreen} as="span" />
          </h1>
          <p className="page__desc">
            <BilingualLabel label={L.settingsSubtitle} as="span" />
          </p>
          {onNavigateView && (
            <p className="page__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => onNavigateView('master')}
              >
                <BilingualLabel label={L.openWarehouseInventory} as="span" />
              </button>
            </p>
          )}
        </div>
        {onForceAuthReset && (
          <button
            type="button"
            className="btn btn--ghost settings__force-logout"
            title="localStorage/sessionStorage 인증 데이터 삭제 후 로그인 화면으로 이동"
            onClick={onForceAuthReset}
          >
            Force Logout (Dev)
          </button>
        )}
      </header>

      <section className="card page__section settings-grid">
        <label>
          As-of date
          <input
            type="date"
            className="cell-input"
            value={opsMeta.asOfDate}
            onChange={(e) => patch('asOfDate', e.target.value)}
          />
        </label>
        <label>
          Timezone label
          <input
            className="cell-input"
            value={opsMeta.timezoneLabel ?? ''}
            onChange={(e) => patch('timezoneLabel', e.target.value)}
          />
        </label>
        <label>
          Timezone (IANA)
          <input
            className="cell-input"
            value={opsMeta.timezone ?? ''}
            onChange={(e) => patch('timezone', e.target.value)}
          />
        </label>
        <label>
          Unit
          <input
            className="cell-input"
            value={opsMeta.unit ?? ''}
            onChange={(e) => patch('unit', e.target.value)}
          />
        </label>
        <label>
          Currency
          <input
            className="cell-input"
            value={opsMeta.currency ?? ''}
            onChange={(e) => patch('currency', e.target.value)}
          />
        </label>
        <label className="settings-grid__full">
          Dashboard title
          <input
            className="cell-input"
            value={opsMeta.title ?? ''}
            onChange={(e) => patch('title', e.target.value)}
          />
        </label>
        <label className="settings-grid__full">
          Subtitle
          <input
            className="cell-input"
            value={opsMeta.subtitle ?? ''}
            onChange={(e) => patch('subtitle', e.target.value)}
          />
        </label>
      </section>

      {isAdmin && typeof setUnitCostKrwBySku === 'function' && (
        <section className="card page__section">
          <h2>
            <BilingualLabel label={L.settingsUnitCostTitle} as="span" />
          </h2>
          <p className="page__hint">
            <BilingualLabel label={L.settingsUnitCostHint} as="span" />
          </p>
          {skuRowsForCost.length === 0 ? (
            <p className="page__hint">
              <BilingualLabel label={L.settingsUnitCostEmpty} as="span" />
            </p>
          ) : (
            <>
              <PageDataToolbar
                hideUpload={isMobile}
                hideDownload={isMobile}
                onUploadChange={handleUnitCostUpload}
                onDownload={handleUnitCostDownload}
                downloadDisabled={displayedSkuRows.length === 0}
                onSave={handleUnitCostSave}
                message={excelMsg}
                searchSlot={
                  <form
                    className="page-search-strip"
                    onSubmit={(e) => {
                      e.preventDefault()
                      setAppliedCostSearch({
                        model: searchCostModel.trim().toLowerCase(),
                        part: searchCostPart.trim().toLowerCase(),
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
                          value={searchCostModel}
                          onChange={(e) => setSearchCostModel(e.target.value)}
                          aria-label={formatKoEnInline(L.pageSearchModel)}
                        />
                      </label>
                      <label className="page-search-strip__field">
                        <span className="page-search-strip__label">
                          <BilingualLabel label={L.pageSearchPartNo} as="span" />
                        </span>
                        <input
                          className="cell-input"
                          value={searchCostPart}
                          onChange={(e) => setSearchCostPart(e.target.value)}
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
                          setSearchCostModel('')
                          setSearchCostPart('')
                          setAppliedCostSearch({ ...EMPTY_COST_SEARCH })
                        }}
                      >
                        <BilingualLabel label={L.pageSearchReset} as="span" />
                      </button>
                    </div>
                  </form>
                }
              />
              <div className="table-wrap">
                <table ref={unitCostTableRef} className="ops-table settings-unit-cost-table">
                  <thead>
                    <tr>
                      <th className="cell--center" style={{ width: '2rem' }}>
                        <input
                          type="checkbox"
                          aria-label="Select all"
                          checked={
                            displayedSkuRows.length > 0 &&
                            selectedCost.size === displayedSkuRows.length
                          }
                          onChange={toggleCostSelectAll}
                        />
                      </th>
                      <th>
                        <BilingualLabel label={L.model} as="span" />
                      </th>
                      <th>
                        <BilingualLabel label={L.partNo} as="span" />
                      </th>
                      <th>
                        <BilingualLabel label={L.settingsUnitCostColKrw} as="span" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedSkuRows.map((row) => (
                      <tr
                        key={row.mapKey}
                        className={
                          invalidCostKeys.has(row.mapKey) ? 'row--excel-invalid' : undefined
                        }
                      >
                        <td className="cell--center">
                          <input
                            type="checkbox"
                            checked={selectedCost.has(row.mapKey)}
                            onChange={() => toggleCostSelect(row.mapKey)}
                            aria-label="Select row"
                          />
                        </td>
                        <td>{row.modelName}</td>
                        <td>
                          <code>{row.partNo}</code>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="cell-input cell-input--num"
                            min={0}
                            step={1}
                            value={
                              unitCostKrwBySku[row.mapKey] == null
                                ? ''
                                : unitCostKrwBySku[row.mapKey]
                            }
                            onChange={(e) => {
                              const raw = e.target.value
                              setUnitCostKrwBySku((prev) => {
                                const next = { ...(prev || {}) }
                                if (raw === '') {
                                  delete next[row.mapKey]
                                } else {
                                  next[row.mapKey] = Math.max(0, Math.round(Number(raw) || 0))
                                }
                                return next
                              })
                            }}
                            aria-label={`Unit cost KRW ${row.modelName} ${row.partNo}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      <section className="card page__section">
        <h2>
          <BilingualLabel label={L.settingsRemoteSyncTitle} as="span" />
        </h2>
        <p className="page__hint">
          <BilingualLabel label={L.settingsRemoteSyncHint} as="span" />
        </p>
        <p className="page__hint">
          <BilingualLabel
            label={remoteSync.enabled ? L.settingsRemoteActive : L.settingsRemoteDisabled}
            as="span"
          />
        </p>
        {remoteSync.enabled && remoteSync.meta && (
          <ul className="page__hint" style={{ margin: '0.25rem 0 0.65rem', paddingLeft: '1.1rem' }}>
            {remoteSync.meta.lastPullOkAt && (
              <li>
                <BilingualLabel label={L.settingsRemoteLastPull} as="span" />:{' '}
                {String(remoteSync.meta.lastPullOkAt)}
              </li>
            )}
            {remoteSync.meta.lastPushOkAt && (
              <li>
                <BilingualLabel label={L.settingsRemoteLastPush} as="span" />:{' '}
                {String(remoteSync.meta.lastPushOkAt)}
              </li>
            )}
            {remoteSync.meta.lastRemoteUpdatedAt && (
              <li>
                <BilingualLabel label={L.settingsRemoteServerTime} as="span" />:{' '}
                {String(remoteSync.meta.lastRemoteUpdatedAt)}
              </li>
            )}
          </ul>
        )}
        <div className="page__actions" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={!remoteSync.enabled || remoteSync.busyPull}
            onClick={() => void remoteSync.onPull?.()}
          >
            {remoteSync.busyPull ? (
              <BilingualLabel label={L.settingsRemoteBusy} as="span" />
            ) : (
              <BilingualLabel label={L.settingsRemotePull} as="span" />
            )}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!remoteSync.enabled || remoteSync.busyPush}
            onClick={() => void remoteSync.onPush?.()}
          >
            {remoteSync.busyPush ? (
              <BilingualLabel label={L.settingsRemoteBusy} as="span" />
            ) : (
              <BilingualLabel label={L.settingsRemotePush} as="span" />
            )}
          </button>
        </div>
      </section>

      <section className="card page__section">
        <h2>
          <BilingualLabel label={L.settingsDataBackupTitle} as="span" />
        </h2>
        <p className="page__hint">
          <BilingualLabel
            label={remoteSync.enabled ? L.settingsDataBackupHintRemote : L.settingsDataBackupHint}
            as="span"
          />
        </p>
        <div className="page__actions" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          {typeof onDownloadAppDataBackup === 'function' && (
            <button type="button" className="btn btn--ghost" onClick={onDownloadAppDataBackup}>
              <BilingualLabel label={L.settingsDataExportButton} as="span" />
            </button>
          )}
          {typeof onImportAppDataBackup === 'function' && (
            <>
              <input
                ref={importBackupInputRef}
                type="file"
                accept="application/json,.json"
                className="page-data-toolbar__file"
                style={{ display: 'none' }}
                onChange={handleImportBackupFile}
              />
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => importBackupInputRef.current?.click()}
              >
                <BilingualLabel label={L.settingsDataImportButton} as="span" />
              </button>
            </>
          )}
        </div>
      </section>

      <section className="card page__section">
        <h2>Data reset</h2>
        <p className="page__hint">
          창고 재고, 출고 계획, 운송중, 시뮬레이션 주간 데이터를 샘플로 되돌리며,{' '}
          <strong>관리자가 입력한 대당 원가(KRW)</strong> 맵도 초기화됩니다. (사용자 계정은 유지)
        </p>
        <button type="button" className="btn btn--ghost" onClick={onResetAllData}>
          Reset all to sample data
        </button>
      </section>

      {isAdmin && users && setUsers && (
        <UserManagementPage users={users} setUsers={setUsers} currentUserId={currentUserId} />
      )}

      <p className="page__hint">
        기본값 참고: as-of {defaultOps.asOfDate}, {defaultOps.timezoneLabel}
      </p>
    </div>
  )
}
