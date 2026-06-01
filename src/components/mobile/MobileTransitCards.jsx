import { normalizeTransitStatus, isTransitRowReceived } from '../../utils/inTransitStatus'
import BilingualLabel from '../BilingualLabel'
import { L } from '../../i18n/labels'
import './mobile-shell.css'

function formatQty(n) {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0))
}

function formatEtaCell(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return '—'
  return s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s
}

function statusClass(row) {
  if (isTransitRowReceived(row)) return 'mobile-line-card__status--muted'
  const eta = String(row?.etaWh ?? '').trim()
  if (!eta) return 'mobile-line-card__status--warn'
  return ''
}

/**
 * 모바일 운송중 / 입고 대기 — 카드 리스트 (조회 전용)
 */
export default function MobileTransitCards({ rows, titleLabel, mode }) {
  if (!rows?.length) {
    return (
      <>
        <h1 className="mobile-page-title">
          <BilingualLabel label={titleLabel} as="span" />
        </h1>
        <p className="mobile-empty">
          <BilingualLabel label={L.mobileTransitEmpty} as="span" />
        </p>
      </>
    )
  }

  return (
    <>
      <h1 className="mobile-page-title">
        <BilingualLabel label={titleLabel} as="span" />
      </h1>
      {mode === 'receiving' ? (
        <p className="mobile-hint" style={{ marginBottom: '0.65rem' }}>
          <BilingualLabel label={L.mobileReceivingTestMode} as="span" compact />
        </p>
      ) : null}
      <ul className="mobile-list">
        {rows.map((row) => {
          const st = normalizeTransitStatus(row?.transitStatus)
          const sc = statusClass(row)
          return (
            <li key={row.id} className="mobile-line-card">
              <div className="mobile-line-card__row">
                <div>
                  <div className="mobile-line-card__model">{row.modelName || '—'}</div>
                  <div className="mobile-line-card__part">{row.partNo || '—'}</div>
                </div>
                <div className="mobile-line-card__qty">{formatQty(row.qty)}</div>
              </div>
              <dl className="mobile-line-card__meta">
                <dt>ETA W/H</dt>
                <dd>{formatEtaCell(row.etaWh)}</dd>
                <dt>Status</dt>
                <dd>
                  <span className={`mobile-line-card__status ${sc}`.trim()}>{st}</span>
                </dd>
              </dl>
            </li>
          )
        })}
      </ul>
    </>
  )
}
