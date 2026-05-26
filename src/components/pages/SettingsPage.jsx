import { useMemo } from 'react'
import { operationsMeta as defaultOps } from '../../data/logisticsSampleData'
import { L, formatKoEn } from '../../i18n/labels'
import { skuCostKey } from '../../utils/unitCostKrw'
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
            <div className="table-wrap">
              <table className="ops-table settings-unit-cost-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Part No</th>
                    <th>
                      <BilingualLabel label={L.settingsUnitCostColKrw} compact as="span" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {skuRowsForCost.map((row) => (
                    <tr key={row.mapKey}>
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
