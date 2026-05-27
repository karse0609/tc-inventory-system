import BilingualLabel from '../BilingualLabel'
import { getCoverageStatus } from '../../config/inventoryPolicy'
import { L } from '../../i18n/labels'
import { formatKrwInteger } from '../../utils/unitCostKrw'

function formatNumber(value) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value))
}

function coverageCardClass(coverageWeeks) {
  const status = getCoverageStatus(coverageWeeks)
  const map = {
    critical: 'dash-kpi__card--cov-critical',
    warning: 'dash-kpi__card--cov-warning',
    stable: 'dash-kpi__card--cov-stable',
    overstock: 'dash-kpi__card--cov-overstock',
  }
  return map[status] || 'dash-kpi__card--cov-neutral'
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

  const cards = [
    { label: L.dashboardWarehouseQty, value: formatNumber(warehouseQty), meta: unit },
    {
      label: L.dashboardWarehouseValue,
      value: formatKrwInteger(warehouseValue),
      meta: 'KRW',
    },
    { label: L.dashboardInTransitQty, value: formatNumber(inTransitQty), meta: unit },
    {
      label: L.dashboardInTransitValue,
      value: formatKrwInteger(inTransitValue),
      meta: 'KRW',
    },
    {
      label: L.totalInventoryValue,
      value: formatKrwInteger(totalKrw),
      meta: 'KRW',
    },
    {
      label: L.dashboardThisWeekEtaQty,
      value: formatNumber(thisWeekEtaQty),
      meta: unit,
    },
    {
      label: L.coverageWeeks,
      value: coverageDisplay(coverageWeeks),
      meta: 'weeks',
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
            <BilingualLabel label={card.label} as="span" />
          </span>
          <strong className="dash-kpi__value">{card.value}</strong>
          {card.meta != null && card.meta !== '' ? (
            <span className="dash-kpi__meta">{card.meta}</span>
          ) : null}
        </article>
      ))}
    </section>
  )
}
