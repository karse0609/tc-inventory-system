import './mobile-shell.css'
import BilingualLabel from '../BilingualLabel'
import { L } from '../../i18n/labels'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '▣' },
  { id: 'transit', label: 'In-Transit', icon: '◈' },
  { id: 'receiving', label: 'Receiving', icon: '◇' },
  { id: 'warehouse', label: 'Inventory', icon: '▤' },
]

/**
 * 모바일 전용 레이아웃 — PC `app-nav`와 무관
 * v1: 클라우드 동기 UI 없음. 새로고침은 이 브라우저에 로드된 데이터 기준 전체 리로드만.
 */
export default function MobileAppShell({ mobileSection, onSection, children, onReload, onLogout, userLabel }) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  })

  return (
    <div className="mobile-shell">
      <header className="mobile-shell__header">
        <div>
          <div className="mobile-shell__brand">TC TECH</div>
          <div className="mobile-shell__sub">Mobile Inventory</div>
          <div className="mobile-shell__date">{today} (KST)</div>
        </div>
        <div className="mobile-shell__actions">
          <button
            type="button"
            className="mobile-shell__btn"
            onClick={onReload}
            aria-describedby="mobile-reload-hint"
          >
            <BilingualLabel label={L.mobileReloadPage} as="span" compact />
          </button>
          <span id="mobile-reload-hint" className="mobile-shell__sr-only">
            <BilingualLabel label={L.mobileReloadPageHint} as="span" />
          </span>
          <button type="button" className="mobile-shell__btn mobile-shell__btn--primary" onClick={onLogout}>
            Logout
          </button>
          {userLabel ? (
            <span style={{ fontSize: '0.72rem', color: '#64748b', maxWidth: '8rem', textAlign: 'right' }}>
              {userLabel}
            </span>
          ) : null}
        </div>
      </header>

      <aside className="mobile-shell__notice" role="note">
        <BilingualLabel label={L.mobileShellReadOnlyNotice} as="p" />
      </aside>

      <main className="mobile-shell__main">{children}</main>

      <nav className="mobile-shell__nav" aria-label="Mobile primary">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`mobile-shell__nav-btn ${mobileSection === t.id ? 'mobile-shell__nav-btn--active' : ''}`}
            onClick={() => onSection(t.id)}
          >
            <span className="mobile-shell__nav-icon" aria-hidden>
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
