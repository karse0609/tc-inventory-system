import { useMemo } from 'react'
import { getDashboardEtaPortWindowRows, isInTransitRowActiveAsOf } from '../../utils/logisticsMetrics'
import { getKoreaCalendarDate } from '../../utils/timeZones'
import BilingualLabel from '../BilingualLabel'
import { L } from '../../i18n/labels'
import './mobile-shell.css'

function formatInt(n) {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0))
}

/**
 * 모바일 홈 — 요약 카드 (PC와 동일 데이터·공용 집계 함수)
 */
export default function MobileDashboardHome({ inTransit, masterItems, opsMeta, unitLabel = 'EA' }) {
  const refDate = getKoreaCalendarDate()
  const asOf = opsMeta?.asOfDate || refDate

  const { inTransitQty, pendingThisWeekQty, warehouseQty } = useMemo(() => {
    const rows = inTransit || []
    const active = rows.filter((r) => isInTransitRowActiveAsOf(r, asOf, refDate))
    const itQty = active.reduce((s, r) => s + (Number(r.qty) || 0), 0)
    const weekRows = getDashboardEtaPortWindowRows(active, asOf)
    const weekQty = weekRows.reduce((s, r) => s + (Number(r.qty) || 0), 0)
    const wh = (masterItems || [])
      .filter((m) => m.status !== 'Inactive')
      .reduce((s, m) => s + (Number(m.currentStock) || 0), 0)
    return { inTransitQty: itQty, pendingThisWeekQty: weekQty, warehouseQty: wh }
  }, [inTransit, masterItems, asOf, refDate])

  return (
    <div className="mobile-home__grid">
      <p className="mobile-hint">
        <BilingualLabel label={L.mobileReadOnlyHint} as="span" compact />
      </p>
      <article className="mobile-card">
        <div className="mobile-card__label">
          <BilingualLabel label={L.inTransitInventoryScreen} as="span" compact />
        </div>
        <div>
          <span className="mobile-card__value">{formatInt(inTransitQty)}</span>
          <span className="mobile-card__unit">{unitLabel}</span>
        </div>
      </article>
      <article className="mobile-card">
        <div className="mobile-card__label">
          <BilingualLabel label={L.warehouseInventoryScreen} as="span" compact />
        </div>
        <div>
          <span className="mobile-card__value">{formatInt(warehouseQty)}</span>
          <span className="mobile-card__unit">{unitLabel}</span>
        </div>
      </article>
      <article className="mobile-card">
        <div className="mobile-card__label">
          <BilingualLabel label={L.mobilePendingReceivingCard} as="span" compact />
        </div>
        <div>
          <span className="mobile-card__value">{formatInt(pendingThisWeekQty)}</span>
          <span className="mobile-card__unit">{unitLabel}</span>
        </div>
        <p className="mobile-hint" style={{ marginTop: '0.5rem' }}>
          <BilingualLabel label={L.mobilePendingReceivingSub} as="span" compact />
        </p>
      </article>
    </div>
  )
}
