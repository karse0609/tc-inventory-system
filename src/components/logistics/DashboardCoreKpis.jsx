import BilingualLabel from '../BilingualLabel'
import { L } from '../../i18n/labels'

function formatNumber(value) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value))
}

function formatCurrency(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function coverageCardClass(coverageWeeks) {
  if (coverageWeeks === Infinity) return 'dash-kpi__card--cov-good'
  if (!Number.isFinite(coverageWeeks)) return 'dash-kpi__card--cov-neutral'
  if (coverageWeeks >= 4) return 'dash-kpi__card--cov-good'
  if (coverageWeeks >= 3) return 'dash-kpi__card--cov-warn'
  return 'dash-kpi__card--cov-bad'
}

function coverageDisplay(coverageWeeks) {
  if (!Number.isFinite(coverageWeeks)) return '∞'
  return coverageWeeks.toFixed(1)
}

/**
 * 실시간 해외재고 대시보드 — 핵심 KPI 6종
 */
export default function DashboardCoreKpis({
  warehouseQty,
  warehouseValue,
  inTransitQty,
  inTransitValue,
  thisWeekEtaQty,
  coverageWeeks,
  unit,
  currency = 'USD',
}) {
  const cards = [
    { label: L.dashboardWarehouseQty, value: formatNumber(warehouseQty), meta: unit },
    {
      label: L.dashboardWarehouseValue,
      value: formatCurrency(warehouseValue, currency),
      meta: currency,
    },
    { label: L.dashboardInTransitQty, value: formatNumber(inTransitQty), meta: unit },
    {
      label: L.dashboardInTransitValue,
      value: formatCurrency(inTransitValue, currency),
      meta: currency,
    },
    {
      label: L.dashboardThisWeekEtaQty,
      value: formatNumber(thisWeekEtaQty),
      meta: unit,
    },
    {
      label: L.coverageWeeks,
      value: coverageDisplay(coverageWeeks),
      meta: <BilingualLabel label={L.weeks} compact as="span" />,
      extraClass: coverageCardClass(coverageWeeks),
    },
  ]

  return (
    <section className="dash-kpi" aria-label="Key performance indicators">
      {cards.map((card) => (
        <article
          key={card.label.en}
          className={`dash-kpi__card ${card.extraClass || ''}`}
        >
          <span className="dash-kpi__label">
            <BilingualLabel label={card.label} compact as="span" />
          </span>
          <strong className="dash-kpi__value">{card.value}</strong>
          <span className="dash-kpi__meta">{card.meta}</span>
        </article>
      ))}
    </section>
  )
}
