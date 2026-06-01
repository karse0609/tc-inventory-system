import { isTransitRowReceived } from '../../utils/inTransitStatus'
import BilingualLabel from '../BilingualLabel'
import { L } from '../../i18n/labels'
import { formatEtaWhDisplay } from '../../utils/transitDisplayFormat'
import './mobile-shell.css'

function statusClass(row) {
  if (isTransitRowReceived(row)) return ''
  const eta = String(row?.etaWh ?? '').trim()
  if (!eta) return 'mobile-line-card__status--warn'
  return ''
}

/**
 * 모바일 운송중 / 입고 대기 — 카드 리스트 (조회 전용)
 * PC In-Transit Active 탭과 동일: 미입고 행만, ETA·수량 표기 동일 규칙.
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
          const sc = statusClass(row)
          const etaShown = formatEtaWhDisplay(row.etaWh)
          return (
            <li key={row.id} className="mobile-line-card">
              <div className="mobile-line-card__row">
                <div>
                  <div className="mobile-line-card__model">{row.modelName || '—'}</div>
                  <div className="mobile-line-card__part">{row.partNo || '—'}</div>
                </div>
                <div className="mobile-line-card__qty">{row.qty ?? ''}</div>
              </div>
              <dl className="mobile-line-card__meta">
                <dt>ETA W/H</dt>
                <dd>{etaShown || '—'}</dd>
                <dt>
                  <BilingualLabel label={L.status} as="span" compact />
                </dt>
                <dd>
                  <span className={`mobile-line-card__status ${sc}`.trim()}>
                    <BilingualLabel label={row.arrived ? L.boolYes : L.boolNo} as="span" compact />
                  </span>
                </dd>
              </dl>
            </li>
          )
        })}
      </ul>
    </>
  )
}
