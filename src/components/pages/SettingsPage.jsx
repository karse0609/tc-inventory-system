import { operationsMeta as defaultOps } from '../../data/logisticsSampleData'
import { L, formatKoEn } from '../../i18n/labels'
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
}) {
  function patch(field, value) {
    setOpsMeta((o) => ({ ...o, [field]: value }))
  }

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

      <section className="card page__section">
        <h2>Data reset</h2>
        <p className="page__hint">
          창고 재고(Warehouse Inventory), 출고 계획, 운송중, 시뮬레이션 주간 데이터를 샘플 초기값으로
          되돌립니다.
          (사용자 계정은 유지됩니다.)
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
