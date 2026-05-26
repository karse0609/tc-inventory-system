import { getCoverageStatusLabel } from '../../config/inventoryPolicy'
import { L } from '../../i18n/labels'
import BilingualLabel from '../BilingualLabel'

function formatNumber(value) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value))
}

function formatDecimal(value, digits = 1) {
  if (!Number.isFinite(value)) return '∞'
  return value.toFixed(digits)
}

function CoverageBadge({ status }) {
  const label = getCoverageStatusLabel(status)
  return (
    <span className={`coverage-badge coverage-badge--${status}`}>
      <BilingualLabel label={label} compact as="span" />
    </span>
  )
}

/**
 * @param {{ variant?: 'default' | 'compact' }} props
 */
export default function InventoryStatusPanel({
  itemRows,
  summary,
  unit,
  variant = 'default',
}) {
  const compact = variant === 'compact'
  const titleLabel = compact ? L.inventoryByPart : L.inventoryStatus

  if (!itemRows?.length) {
    return (
      <section
        className={`ops-section card inv-status-panel${compact ? ' inv-status-panel--compact' : ''}`}
      >
        <h2 className="ops-section__title">
          <BilingualLabel label={titleLabel} compact as="span" />
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
    <section
      className={`ops-section card inv-status-panel${compact ? ' inv-status-panel--compact' : ''}`}
    >
      <h2 className="ops-section__title">
        <BilingualLabel label={titleLabel} compact as="span" />
      </h2>

      {!compact && (
        <>
          <article className={`inv-hero inv-hero--${headlineStatus}`}>
            <div className="inv-hero__main">
              <span className="inv-hero__label">
                <BilingualLabel label={L.coverageWeeks} compact as="span" />
                <span className="inv-hero__hint">
                  (<BilingualLabel label={L.demandBasedCoverage} compact as="span" />)
                </span>
              </span>
              <strong className="inv-hero__value">{formatDecimal(headlineCoverage)}</strong>
              <span className="inv-hero__unit">
                <BilingualLabel label={L.weeks} compact as="span" /> · min across parts
              </span>
            </div>
            <CoverageBadge status={headlineStatus} />
            <p className="inv-hero__policy">
              <BilingualLabel label={L.safetyStockPerMaster} compact as="span" /> ·{' '}
              <BilingualLabel label={L.coverageLegend} compact as="span" />
            </p>
          </article>
        </>
      )}

      {compact && (
        <p className="inv-status-panel__hint">
          <BilingualLabel label={L.coverageLegend} compact as="span" />
        </p>
      )}

      <div className="table-wrap">
        <table className="ops-table inv-item-table">
          <thead>
            <tr>
              <th>
                <BilingualLabel label={L.model} compact />
              </th>
              <th>
                <BilingualLabel label={L.partNo} compact />
              </th>
              {!compact && (
                <th>
                  <BilingualLabel label={L.description} compact />
                </th>
              )}
              <th>
                <BilingualLabel label={L.currentStock} compact />
              </th>
              {!compact && (
                <>
                  <th>
                    <BilingualLabel label={L.weeklyDemandShort} compact />
                  </th>
                  <th>
                    <BilingualLabel label={L.weeklyDeliveryQty} compact />
                  </th>
                </>
              )}
              <th>
                <BilingualLabel label={L.coverageWeeks} compact />
              </th>
              {!compact && (
                <th>
                  <BilingualLabel label={L.safetyStock} compact />
                </th>
              )}
              <th>
                <BilingualLabel label={L.gap} compact />
              </th>
              <th>
                <BilingualLabel label={L.status} compact />
              </th>
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
                {!compact && <td className="inv-item-table__desc">{row.description}</td>}
                <td className="cell--num">{formatNumber(row.currentStock)}</td>
                {!compact && (
                  <>
                    <td className="cell--num">{formatNumber(row.weeklyDemand)}</td>
                    <td className="cell--num">{formatNumber(row.plannedDelivery)}</td>
                  </>
                )}
                <td className="cell--num">
                  <strong>{formatDecimal(row.coverageWeeks)}</strong>
                </td>
                {!compact && <td className="cell--num">{formatNumber(row.safetyStockQty)}</td>}
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
