import BilingualLabel from '../BilingualLabel'
import { getCoverageStatus } from '../../config/inventoryPolicy'
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

export default function TodayStatus({ metrics, unit, currency = 'USD' }) {
  const cov = metrics.coverageWeeks
  const covFinite = cov != null && Number.isFinite(cov)
  const covDisplay = covFinite ? cov.toFixed(1) : '—'
  const covStatus = getCoverageStatus(cov)

  const demandSum = metrics.modelWeeklyDemandTotal ?? 0

  const cards = [
    {
      label: L.todayShipment,
      value: formatNumber(metrics.todayShipmentQty),
      meta: unit,
    },
    {
      label: L.inTransitContainers,
      value: formatNumber(metrics.inTransitCount),
      meta: `${formatNumber(metrics.inTransitQty)} ${unit}`,
    },
    {
      label: L.thisWeekEta,
      value: formatNumber(metrics.thisWeekEtaCount),
      meta: `${formatNumber(metrics.thisWeekEtaQty)} ${unit}`,
    },
    {
      label: L.thisWeekDelivery,
      value: formatNumber(metrics.thisWeekDeliveryQty),
      meta: unit,
    },
    {
      label: L.currentInventory,
      value: formatNumber(metrics.currentInventory),
      meta: (
        <span className="today-status__meta-inline">
          <BilingualLabel label={L.modelTotal} as="span" />
        </span>
      ),
      highlight: true,
    },
    {
      label: L.weeklyDemandTotal,
      value: formatNumber(demandSum),
      meta: (
        <span className="today-status__meta-inline">
          <BilingualLabel label={L.weeklyDemandShort} as="span" /> · Master
        </span>
      ),
      highlight: true,
    },
    {
      label: L.coverageWeeks,
      value: covDisplay,
      meta: (
        <span className="today-status__meta-inline">
          <BilingualLabel label={L.weeks} as="span" /> ·{' '}
          <BilingualLabel label={L.flowCoverageHeroHint} as="span" />
        </span>
      ),
      covTone: covStatus,
    },
    {
      label: L.inventoryValue,
      value: formatCurrency(metrics.totalInventoryValue, currency),
      meta: `${L.totalInventoryValue.en}`,
      highlight: true,
    },
  ]

  return (
    <section className="ops-section card">
      <h2 className="ops-section__title ops-section__title--stacked">
        <BilingualLabel label={L.todayStatus} as="span" />
      </h2>
      <div className="today-status today-status--8">
        {cards.map((card) => (
          <article
            key={card.label.en}
            className={`today-status__card ${card.highlight ? 'today-status__card--primary' : ''} ${
              card.covTone ? `today-status__card--${card.covTone}` : ''
            }`}
          >
            <span className="today-status__label">
              <BilingualLabel label={card.label} as="span" />
            </span>
            <strong className="today-status__value">{card.value}</strong>
            <span className="today-status__meta">{card.meta}</span>
          </article>
        ))}
      </div>
    </section>
  )
}
