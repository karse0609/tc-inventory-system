import { getCoverageStatus, getCoverageStatusLabel } from '../../config/inventoryPolicy'
import { L } from '../../i18n/labels'
import BilingualLabel from '../BilingualLabel'

function formatNumber(value) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value))
}

function formatDecimal(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

function CoverageBadge({ status }) {
  const label = getCoverageStatusLabel(status)
  return (
    <span className={`coverage-badge coverage-badge--${status}`}>
      <BilingualLabel
        compact
        className="coverage-badge__label"
        enClassName="coverage-badge__en"
        label={label}
        as="span"
      />
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
  const unitStr = String(unit ?? '').trim()

  if (!itemRows?.length) {
    return (
      <section
        className={`ops-section card inv-status-panel${compact ? ' inv-status-panel--compact' : ''}`}
      >
        <h2 className="ops-section__title ops-section__title--stacked">
          <BilingualLabel label={titleLabel} as="span" />
        </h2>
        <p className="empty-block">No inventory data for selected model.</p>
      </section>
    )
  }

  const headlineCoverage = summary?.portfolioCoverageWeeks ?? summary?.minCoverageWeeks
  const headlineStatus = getCoverageStatus(headlineCoverage)

  return (
    <section
      className={`ops-section card inv-status-panel${compact ? ' inv-status-panel--compact' : ''}`}
    >
      <h2 className="ops-section__title ops-section__title--stacked">
        <BilingualLabel label={titleLabel} as="span" />
      </h2>

      {!compact && (
        <>
          <article className={`inv-hero inv-hero--${headlineStatus}`}>
            <div className="inv-hero__main">
              <span className="inv-hero__label">
                <BilingualLabel label={L.coverageWeeks} as="span" />
                <span className="inv-hero__hint">
                  (<BilingualLabel label={L.flowCoverageHeroHint} as="span" />)
                </span>
              </span>
              <strong className="inv-hero__value">
                {headlineCoverage != null && Number.isFinite(headlineCoverage)
                  ? formatDecimal(headlineCoverage)
                  : '—'}
              </strong>
              <span className="inv-hero__unit">
                <BilingualLabel label={L.weeks} as="span" />
              </span>
            </div>
            <CoverageBadge status={headlineStatus} />
            <p className="inv-hero__policy">
              <BilingualLabel label={L.safetyStockPerMaster} as="span" /> ·{' '}
              <BilingualLabel label={L.coverageLegend} as="span" />
            </p>
          </article>
        </>
      )}

      {compact && (
        <p className="inv-status-panel__hint">
          <BilingualLabel label={L.coverageLegend} as="span" />
        </p>
      )}

      <div className="table-wrap">
        <table className={`ops-table inv-item-table${compact ? ' dash-board-table' : ''}`}>
          <thead>
            <tr>
              <th>
                <BilingualLabel label={L.model} />
              </th>
              <th>
                <BilingualLabel label={L.partNo} />
              </th>
              <th className="inv-th--in-transit">
                <span className="inv-th--in-transit__main">
                  <BilingualLabel label={L.inventoryTableInTransit} />
                </span>
                {unitStr ? <span className="inv-col-unit">{unitStr}</span> : null}
              </th>
              {!compact && (
                <th>
                  <BilingualLabel label={L.description} />
                </th>
              )}
              <th>
                <BilingualLabel label={L.currentStock} />
              </th>
              {!compact && (
                <>
                  <th>
                    <BilingualLabel label={L.weeklyDemandShort} />
                  </th>
                  <th>
                    <BilingualLabel label={L.weeklyDeliveryQty} />
                  </th>
                </>
              )}
              <th>
                <BilingualLabel label={L.coverageWeeks} />
              </th>
              {!compact && (
                <th>
                  <BilingualLabel label={L.safetyStock} />
                </th>
              )}
              <th>
                <BilingualLabel label={L.gap} />
              </th>
              <th>
                <BilingualLabel label={L.status} />
              </th>
            </tr>
          </thead>
          <tbody>
            {itemRows.map((row) => (
              <tr
                key={`${row.modelName}\t${row.partNo}`}
                className={`row--coverage-${row.status}`}
              >
                <td>
                  <code>{row.modelName}</code>
                </td>
                <td>
                  <code>{row.partNo}</code>
                </td>
                <td className="cell--num inv-td--in-transit">{formatNumber(row.inTransitQty)}</td>
                {!compact && <td className="inv-item-table__desc">{row.description}</td>}
                <td className="cell--num">{formatNumber(row.currentStock)}</td>
                {!compact && (
                  <>
                    <td className="cell--num">
                      {row.weeklyDemand == null || !Number.isFinite(row.weeklyDemand)
                        ? '—'
                        : formatNumber(row.weeklyDemand)}
                    </td>
                    <td className="cell--num">
                      {row.plannedDelivery == null || !Number.isFinite(row.plannedDelivery)
                        ? '—'
                        : formatNumber(row.plannedDelivery)}
                    </td>
                  </>
                )}
                <td className="cell--num">
                  <strong>{formatDecimal(row.coverageWeeks)}</strong>
                </td>
                {!compact && (
                  <td className="cell--num">
                    {row.safetyStockQty == null || !Number.isFinite(row.safetyStockQty)
                      ? '—'
                      : formatNumber(row.safetyStockQty)}
                  </td>
                )}
                <td
                  className={`cell--num ${
                    row.gap != null && Number.isFinite(row.gap) && row.gap < 0
                      ? 'text-warn'
                      : 'cell--in'
                  }`}
                >
                  {row.gap == null || !Number.isFinite(row.gap)
                    ? '—'
                    : `${row.gap >= 0 ? '+' : ''}${formatNumber(row.gap)}`}
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
