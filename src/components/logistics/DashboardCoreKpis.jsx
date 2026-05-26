import BilingualLabel from '../BilingualLabel'
import { L } from '../../i18n/labels'
import { formatKrwTotal } from '../../utils/unitCostKrw'

function formatNumber(value) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value))
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
 * 실시간 해외재고 대시보드 — 핵심 KPI (수량·KRW 금액·ETA·커버리지)
 * 재고 금액은 Settings의 대당 원가(KRW)만 사용합니다.
 */
export default function DashboardCoreKpis({
  warehouseQty,
  warehouseValue,
  inTransitQty,
  inTransitValue,
  thisWeekEtaQty,
  coverageWeeks,
  unit,
}) {
  const totalKrw = (Number(warehouseValue) || 0) + (Number(inTransitValue) || 0)
  const krwMeta = 'KRW'

  const cards = [
    { label: L.dashboardWarehouseQty, value: formatNumber(warehouseQty), meta: unit },
    {
      label: L.dashboardWarehouseValue,
      value: formatKrwTotal(warehouseValue),
      meta: krwMeta,
    },
    { label: L.dashboardInTransitQty, value: formatNumber(inTransitQty), meta: unit },
    {
      label: L.dashboardInTransitValue,
      value: formatKrwTotal(inTransitValue),
      meta: krwMeta,
    },
    {
      label: L.totalInventoryValue,
      value: formatKrwTotal(totalKrw),
      meta: krwMeta,
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
