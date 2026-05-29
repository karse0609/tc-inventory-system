import BilingualLabel from '../BilingualLabel'
import { getCoverageStatus } from '../../config/inventoryPolicy'
import { L } from '../../i18n/labels'
import { formatKrwInteger } from '../../utils/unitCostKrw'

function formatNumber(value) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value))
}

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

function aggregateRiskClass(level) {
  if (level === 'critical') return 'dash-kpi__card--aggregate-risk dash-kpi__card--aggregate-risk-critical'
  if (level === 'warning') return 'dash-kpi__card--aggregate-risk dash-kpi__card--aggregate-risk-warning'
  return ''
}

/**
 * 실시간 해외재고 대시보드 — 핵심 KPI (운영 우선순서)
 * 재고 금액은 Settings의 대당 원가(KRW)만 사용합니다.
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
  aggregateRisk = 'ok',
  showTotalInventoryValue = true,
}) {
  const totalKrw = (Number(warehouseValue) || 0) + (Number(inTransitValue) || 0)
  const riskExtra = aggregateRiskClass(aggregateRisk)

  const cards = [
    ...(showTotalInventoryValue
      ? [
          {
            key: 'total-value',
            label: L.totalInventoryValue,
            value: formatKrwInteger(totalKrw),
            meta: 'KRW',
            extraClass: riskExtra,
          },
        ]
      : []),
    {
      key: 'wh-qty',
      label: L.dashboardWarehouseQty,
      value: formatNumber(warehouseQty),
      meta: unit,
      extraClass: riskExtra,
    },
    {
      key: 'tr-qty',
      label: L.dashboardInTransitQty,
      value: formatNumber(inTransitQty),
      meta: unit,
      extraClass: riskExtra,
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
      extraClass: riskExtra,
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
