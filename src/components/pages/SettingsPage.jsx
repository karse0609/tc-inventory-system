import { useCallback, useMemo, useRef, useState } from 'react'
import { operationsMeta as defaultOps } from '../../data/logisticsSampleData'
import { L, formatKoEn } from '../../i18n/labels'
import { skuCostKey } from '../../utils/unitCostKrw'
import {
  matrixToTsv,
  parseQtyCell,
  readClipboardText,
  splitTsvToMatrix,
  writeClipboardText,
} from '../../utils/excelGridClipboard'
import ExcelGridToolbar from '../grid/ExcelGridToolbar.jsx'
import useGridNativePaste from '../../hooks/useGridNativePaste.js'
import BilingualLabel from '../BilingualLabel'
import UserManagementPage from './UserManagementPage.jsx'
import '../logistics/ops.css'
import './pages.css'

export default function SettingsPage({
  opsMeta,
  setOpsMeta,
  onResetAllData,
  isAdmin = false,
  users,
  setUsers,
  currentUserId,
  onForceAuthReset,
  onNavigateView,
  masterItems = [],
  unitCostKrwBySku = {},
  setUnitCostKrwBySku,
}) {
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
  const unitCostTableRef = useRef(null)

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
      if (s.size === skuRowsForCost.length) return new Set()
      return new Set(skuRowsForCost.map((r) => r.mapKey))
    })
  }, [skuRowsForCost])

  const firstSelectedCostIndex = useMemo(() => {
    if (!selectedCost.size) return 0
    const ix = skuRowsForCost.findIndex((r) => selectedCost.has(r.mapKey))
    return ix >= 0 ? ix : 0
  }, [skuRowsForCost, selectedCost])

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
      setExcelMsg(errs.length ? `!${errs.slice(0, 6).join('\n')}` : formatKoEn(L.excelPasteDone))
    },
    [skuRowsForCost, setUnitCostKrwBySku],
  )

  const handlePasteUnitCost = useCallback(async () => {
    if (typeof setUnitCostKrwBySku !== 'function') return
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
    applyUnitCostMatrix(matrix, firstSelectedCostIndex)
  }, [applyUnitCostMatrix, firstSelectedCostIndex, setUnitCostKrwBySku])

  const onUnitCostNativePaste = useCallback(
    (matrix, cell) => {
      const row = Number.parseInt(String(cell.getAttribute('data-excel-row') ?? ''), 10)
      applyUnitCostMatrix(matrix, Number.isFinite(row) ? row : 0)
    },
    [applyUnitCostMatrix],
  )

  useGridNativePaste({
    tableRef: unitCostTableRef,
    enabled: Boolean(isAdmin && skuRowsForCost.length > 0 && typeof setUnitCostKrwBySku === 'function'),
    onPasteMatrix: onUnitCostNativePaste,
  })

  const handleCopyUnitCost = useCallback(async () => {
    setExcelMsg('')
    const header = ['Model', 'Part No', 'Unit cost (KRW)']
    const src =
      selectedCost.size > 0
        ? skuRowsForCost.filter((r) => selectedCost.has(r.mapKey))
        : skuRowsForCost
    const body = src.map((row) => [
      row.modelName,
      row.partNo,
      unitCostKrwBySku[row.mapKey] == null ? '' : String(unitCostKrwBySku[row.mapKey]),
    ])
    await writeClipboardText(matrixToTsv([header, ...body]))
    setExcelMsg(formatKoEn(L.excelCopyDone))
  }, [skuRowsForCost, selectedCost, unitCostKrwBySku])

  const handleClearUnitCost = useCallback(() => {
    if (!selectedCost.size || typeof setUnitCostKrwBySku !== 'function') return
    setUnitCostKrwBySku((prev) => {
      const next = { ...(prev || {}) }
      for (const k of selectedCost) delete next[k]
      return next
    })
    setSelectedCost(new Set())
    setInvalidCostKeys(new Set())
    setExcelMsg('')
  }, [selectedCost, setUnitCostKrwBySku])

  return (
    <div className="page">
      <header className="page__header page__header--row">
        <div>
          <h1>
            <BilingualLabel label={L.settingsScreen} compact as="span" />
          </h1>
          <p className="page__desc">
            <BilingualLabel label={L.settingsSubtitle} compact as="span" />
          </p>
          {onNavigateView && (
            <p className="page__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => onNavigateView('master')}
              >
                {formatKoEn(L.openWarehouseInventory)}
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
            <BilingualLabel label={L.settingsUnitCostTitle} compact as="span" />
          </h2>
          <p className="page__hint">
            <BilingualLabel label={L.settingsUnitCostHint} compact as="span" />
          </p>
          {skuRowsForCost.length === 0 ? (
            <p className="page__hint">
              <BilingualLabel label={L.settingsUnitCostEmpty} compact as="span" />
            </p>
          ) : (
            <>
              <ExcelGridToolbar
                onPasteFromExcel={handlePasteUnitCost}
                onCopyToExcel={handleCopyUnitCost}
                onClearSelected={handleClearUnitCost}
                selectedCount={selectedCost.size}
                message={excelMsg}
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
                            skuRowsForCost.length > 0 &&
                            selectedCost.size === skuRowsForCost.length
                          }
                          onChange={toggleCostSelectAll}
                        />
                      </th>
                      <th>Model</th>
                      <th>Part No</th>
                      <th>
                        <BilingualLabel label={L.settingsUnitCostColKrw} compact as="span" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {skuRowsForCost.map((row, rowIdx) => (
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
                            data-excel-paste
                            data-excel-row={rowIdx}
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
