import {
  getCoverageStatusLabel,
} from '../../config/inventoryPolicy'
import { L } from '../../i18n/labels'
import BilingualLabel from '../BilingualLabel'

function formatNumber(value) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value))
}

function formatDecimal(value, digits = 1) {
  if (!Number.isFinite(value)) return '∞'
  return value.toFixed(digits)
}

function formatCurrency(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function CoverageBadge({ status }) {
  const label = getCoverageStatusLabel(status)
  return (
    <span className={`coverage-badge coverage-badge--${status}`}>
      <BilingualLabel label={label} as="span" />
    </span>
  )
}

export default function InventoryStatusPanel({
  itemRows,
  summary,
  unit,
  currency,
}) {
  if (!itemRows?.length) {
    return (
      <section className="ops-section card inv-status-panel">
        <h2 className="ops-section__title">
          <BilingualLabel label={L.inventoryStatus} as="span" />
        </h2>
        <p className="empty-block">No inventory data for selected model.</p>
      </section>
    )
  }

  const headlineCoverage = summary?.minCoverageWeeks ?? 0
  const headlineStatus = itemRows.reduce((worst, row) => {
    const order = { danger: 0, caution: 1, stable: 2 }
    return order[row.status] < order[worst] ? row.status : worst
  }, 'stable')

  return (
    <section className="ops-section card inv-status-panel">
      <h2 className="ops-section__title">
        <BilingualLabel label={L.inventoryStatus} as="span" />
      </h2>

      <article className={`inv-hero inv-hero--${headlineStatus}`}>
        <div className="inv-hero__main">
          <span className="inv-hero__label">
            <BilingualLabel label={L.coverageWeeks} as="span" />
            <span className="inv-hero__hint">
              (<BilingualLabel label={L.demandBasedCoverage} as="span" />)
            </span>
          </span>
          <strong className="inv-hero__value">{formatDecimal(headlineCoverage)}</strong>
          <span className="inv-hero__unit">
            {L.weeks.ko} ({L.weeks.en}) · min across parts
          </span>
        </div>
        <CoverageBadge status={headlineStatus} />
        <p className="inv-hero__policy">
          <BilingualLabel label={L.safetyStockPerMaster} as="span" /> ·{' '}
          <BilingualLabel label={L.coverageLegend} as="span" />
        </p>
      </article>

      <div className="inv-value-grid">
        <article className="inv-value-card">
          <span className="inv-value-card__label">
            <BilingualLabel label={L.warehouseInventoryValue} as="span" />
          </span>
          <strong className="inv-value-card__value">
            {formatCurrency(summary.warehouseValue, currency)}
          </strong>
          <span className="inv-value-card__sub">
            {formatNumber(summary.totalStock)} {unit}
          </span>
        </article>
        <article className="inv-value-card">
          <span className="inv-value-card__label">
            <BilingualLabel label={L.inTransitInventoryValue} as="span" />
          </span>
          <strong className="inv-value-card__value">
            {formatCurrency(summary.inTransitValue, currency)}
          </strong>
          <span className="inv-value-card__sub">
            {formatNumber(summary.totalInTransit)} {unit}
          </span>
        </article>
        <article className="inv-value-card inv-value-card--total">
          <span className="inv-value-card__label">
            <BilingualLabel label={L.totalInventoryValue} as="span" />
          </span>
          <strong className="inv-value-card__value">
            {formatCurrency(summary.totalInventoryValue, currency)}
          </strong>
          <span className="inv-value-card__sub">
            {itemRows.length} parts · {currency}
          </span>
        </article>
      </div>

      <div className="table-wrap">
        <table className="ops-table inv-item-table">
          <thead>
            <tr>
              <th><BilingualLabel label={L.model} /></th>
              <th><BilingualLabel label={L.partNo} /></th>
              <th><BilingualLabel label={L.description} /></th>
              <th><BilingualLabel label={L.currentStock} /></th>
              <th><BilingualLabel label={L.weeklyDemandShort} /></th>
              <th><BilingualLabel label={L.plannedDelivery} /></th>
              <th><BilingualLabel label={L.confirmedDelivery} /></th>
              <th><BilingualLabel label={L.coverageWeeks} /></th>
              <th><BilingualLabel label={L.safetyStock} /></th>
              <th><BilingualLabel label={L.gap} /></th>
              <th><BilingualLabel label={L.status} /></th>
            </tr>
          </thead>
          <tbody>
            {itemRows.map((row) => (
              <tr key={row.partNo} className={`row--coverage-${row.status}`}>
                <td>
                  <code>{row.modelName}</code>
                </td>
                <td>
                  <code>{row.partNo}</code>
                </td>
                <td className="inv-item-table__desc">{row.description}</td>
                <td className="cell--num">{formatNumber(row.currentStock)}</td>
                <td className="cell--num">{formatNumber(row.weeklyDemand)}</td>
                <td className="cell--num">{formatNumber(row.plannedDelivery)}</td>
                <td className="cell--num">
                  {row.confirmedDelivery != null
                    ? formatNumber(row.confirmedDelivery)
                    : '—'}
                </td>
                <td className="cell--num">
                  <strong>{formatDecimal(row.coverageWeeks)}</strong>
                </td>
                <td className="cell--num">{formatNumber(row.safetyStockQty)}</td>
                <td className={`cell--num ${row.gap < 0 ? 'text-warn' : 'cell--in'}`}>
                  {row.gap >= 0 ? '+' : ''}
                  {formatNumber(row.gap)}
                </td>
                <td>
                  <CoverageBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
