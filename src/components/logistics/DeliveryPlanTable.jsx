import BilingualLabel from '../BilingualLabel'
import { L } from '../../i18n/labels'
import { getWeekRange } from '../../utils/logisticsMetrics'

function formatNumber(value) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value))
}

export default function DeliveryPlanTable({ plans, asOfDate }) {
  const weekRange = getWeekRange(asOfDate)

  return (
    <section className="ops-section card">
      <h2 className="ops-section__title">
        <BilingualLabel label={L.deliveryPlan} as="span" />
        <span className="ops-section__sub">
          <BilingualLabel label={L.fromItemPlans} as="span" />
        </span>
      </h2>
      <div className="table-wrap">
        <table className="ops-table">
          <thead>
            <tr>
              <th><BilingualLabel label={L.week} /></th>
              <th><BilingualLabel label={L.model} /></th>
              <th><BilingualLabel label={L.plannedQty} /></th>
              <th><BilingualLabel label={L.confirmedQty} /></th>
              <th><BilingualLabel label={L.status} /></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((row, idx) => {
              const isThisWeek =
                row.periodStart >= weekRange.start &&
                row.periodStart <= weekRange.end
              return (
                <tr
                  key={`${row.modelName}-${row.week}-${row.periodStart}-${idx}`}
                  className={isThisWeek ? 'row--current' : ''}
                >
                  <td>
                    <strong>{row.label}</strong>
                    <span className="cell-sub">{row.periodStart}</span>
                  </td>
                  <td>{row.modelName}</td>
                  <td className="cell--num">{formatNumber(row.plannedQty)}</td>
                  <td className="cell--num">
                    {row.confirmedQty != null ? formatNumber(row.confirmedQty) : '—'}
                  </td>
                  <td>
                    <span
                      className={`status-pill status-pill--${row.status === 'in_progress' ? 'active' : 'planned'}`}
                    >
                      {row.status === 'in_progress' ? 'In Progress' : 'Planned'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
