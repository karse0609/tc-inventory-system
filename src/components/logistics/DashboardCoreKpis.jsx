import BilingualLabel from '../BilingualLabel'
import { getCoverageStatus } from '../../config/inventoryPolicy'
import { L } from '../../i18n/labels'
import { formatKrwInteger } from '../../utils/unitCostKrw'

function formatNumber(value) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value))
}

/** 커버리지 KPI만 구간별 테두리·배경 (나머지 카드는 기본 스타일) */
function coverageCardClass(coverageWeeks) {
  if (coverageWeeks == null || !Number.isFinite(coverageWeeks)) {
    return 'dash-kpi__card--cov-neutral'
  }
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
  if (coverageWeeks == null || !Number.isFinite(coverageWeeks)) return '—'
  return coverageWeeks.toFixed(1)
}

/**
 * 실시간 해외재고 대시보드 — 핵심 KPI
 * 재고 금액(KRW)은 Settings의 대당 원가 맵만 사용합니다.
 * 상태 색은 커버리지 카드에만 적용합니다.
 */
export default function DashboardCoreKpis({
  warehouseQty,
  warehouseValue,
  inTransitQty,
  inTransitValue,
  thisWeekEtaQty,
  thisWeekEtaContainerCount,
  coverageWeeks,
  unit,
}) {
  const totalKrw = (Number(warehouseValue) || 0) + (Number(inTransitValue) || 0)

  const cards = [
    {
      key: 'total-value',
      label: L.totalInventoryValue,
      value: formatKrwInteger(totalKrw),
      meta: 'KRW',
    },
    {
      key: 'wh-value',
      label: L.dashboardWarehouseValue,
      value: formatKrwInteger(warehouseValue),
      meta: 'KRW',
    },
    {
      key: 'tr-value',
      label: L.dashboardInTransitValue,
      value: formatKrwInteger(inTransitValue),
      meta: 'KRW',
    },
    {
      key: 'wh-qty',
      label: L.dashboardWarehouseQty,
      value: formatNumber(warehouseQty),
      meta: unit,
    },
    {
      key: 'tr-qty',
      label: L.dashboardInTransitQty,
      value: formatNumber(inTransitQty),
      meta: unit,
    },
    {
      key: 'coverage',
      label: L.coverageWeeks,
      value: coverageDisplay(coverageWeeks),
      meta: 'weeks',
      extraClass: coverageCardClass(coverageWeeks),
    },
    {
      key: 'eta',
      label: L.dashboardThisWeekEtaQty,
      kind: 'portEtaDue',
      value: formatNumber(thisWeekEtaQty),
      value2: formatNumber(thisWeekEtaContainerCount ?? 0),
      meta: unit,
    },
  ]

  return (
    <section className="dash-kpi" aria-label="Key performance indicators">
      {cards.map((card) => (
        <article
          key={card.key}
          className={`dash-kpi__card ${card.extraClass || ''}`.trim()}
        >
          <span className="dash-kpi__label">
            <BilingualLabel label={card.label} as="span" />
          </span>
          {card.kind === 'portEtaDue' ? (
            <strong className="dash-kpi__value dash-kpi__value--eta-dual">
              <span className="dash-kpi__eta-line">
                {card.value} <span className="dash-kpi__eta-unit">{unit}</span>
              </span>
              <span className="dash-kpi__eta-line dash-kpi__eta-line--cntr">
                {card.value2} <span className="dash-kpi__eta-unit">CNTR</span>
              </span>
            </strong>
          ) : (
            <strong className="dash-kpi__value">{card.value}</strong>
          )}
          {card.meta != null && card.meta !== '' && card.kind !== 'portEtaDue' ? (
            <span className="dash-kpi__meta">{card.meta}</span>
          ) : null}
        </article>
      ))}
    </section>
  )
}
