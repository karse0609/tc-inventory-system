import BilingualLabel from '../BilingualLabel'
import { L } from '../../i18n/labels'

function formatNumber(value) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value))
}

export default function ThisWeekEta({ rows, weekRange }) {
  return (
    <section className="ops-section card">
      <h2 className="ops-section__title">
        <BilingualLabel label={L.thisWeekEtaSection} as="span" />
        <span className="ops-section__sub">
          {weekRange.start} ~ {weekRange.end}
        </span>
      </h2>
      <div className="eta-cards">
        {rows.length === 0 ? (
          <p className="empty-block">No arrivals scheduled this week.</p>
        ) : (
          rows.map((row) => (
            <article
              key={row.id ?? row.containerNo}
              className={`eta-card ${row.remark ? 'eta-card--delay' : ''}`}
            >
              <div className="eta-card__head">
                <code>{row.containerNo}</code>
                {row.remark ? (
                  <span className="delay-badge">
                    <BilingualLabel label={L.delayWarning} as="span" />
                  </span>
                ) : (
                  <span className="ok-badge">
                    <BilingualLabel label={L.onTime} as="span" />
                  </span>
                )}
              </div>
              <p className="eta-card__model">
                {row.modelName} · {row.partNo}
              </p>
              <dl className="eta-card__meta">
                <div>
                  <dt><BilingualLabel label={L.etaPort} /></dt>
                  <dd>{row.etaPort}</dd>
                </div>
                <div>
                  <dt><BilingualLabel label={L.etaWh} /></dt>
                  <dd>{row.etaWh || '—'}</dd>
                </div>
                <div>
                  <dt><BilingualLabel label={L.qty} /></dt>
                  <dd>{formatNumber(row.qty)}</dd>
                </div>
                <div>
                  <dt><BilingualLabel label={L.deliveryLocation} /></dt>
                  <dd>{row.deliveryLocation || '—'}</dd>
                </div>
              </dl>
              {row.remark ? (
                <p className="eta-card__reason">{row.remark}</p>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  )
}
