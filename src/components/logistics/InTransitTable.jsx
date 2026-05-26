import BilingualLabel from '../BilingualLabel'
import { L } from '../../i18n/labels'
import { isInTransitRowActive } from '../../utils/logisticsMetrics'

function formatNumber(value) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value))
}

export default function InTransitTable({ rows }) {
  const activeRows = rows.filter(isInTransitRowActive)

  return (
    <section className="ops-section card">
      <h2 className="ops-section__title">
        <BilingualLabel label={L.inTransitTable} as="span" />
        <span className="ops-section__count">{activeRows.length}</span>
      </h2>
      <div className="table-wrap">
        <table className="ops-table">
          <thead>
            <tr>
              <th><BilingualLabel label={L.containerNo} /></th>
              <th><BilingualLabel label={L.model} /></th>
              <th><BilingualLabel label={L.partNo} /></th>
              <th><BilingualLabel label={L.qty} /></th>
              <th><BilingualLabel label={L.etdTcTech} /></th>
              <th><BilingualLabel label={L.etdPort} /></th>
              <th><BilingualLabel label={L.etaPort} /></th>
              <th><BilingualLabel label={L.etaWh} /></th>
              <th><BilingualLabel label={L.deliveryLocation} /></th>
              <th><BilingualLabel label={L.remark} /></th>
            </tr>
          </thead>
          <tbody>
            {activeRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="empty">
                  No in-transit containers
                </td>
              </tr>
            ) : (
              activeRows.map((row) => (
                <tr key={row.id ?? row.containerNo}>
                  <td>
                    <code>{row.containerNo}</code>
                  </td>
                  <td>{row.modelName}</td>
                  <td>{row.partNo}</td>
                  <td className="cell--num">{formatNumber(row.qty)}</td>
                  <td>{row.etdTcTech}</td>
                  <td>{row.etdPort}</td>
                  <td>{row.etaPort}</td>
                  <td>{row.etaWh}</td>
                  <td>{row.deliveryLocation}</td>
                  <td className="cell--muted">{row.remark}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
