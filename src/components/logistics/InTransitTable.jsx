import BilingualLabel from '../BilingualLabel'
import { L } from '../../i18n/labels'

function formatNumber(value) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value))
}

export default function InTransitTable({ rows }) {
  return (
    <section className="ops-section card">
      <h2 className="ops-section__title">
        <BilingualLabel label={L.inTransitTable} as="span" />
        <span className="ops-section__count">{rows.length}</span>
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
              <th><BilingualLabel label={L.status} /></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty">
                  No in-transit containers
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id ?? row.containerNo} className={row.delayed ? 'row--delay' : ''}>
                  <td>
                    <code>{row.containerNo}</code>
                  </td>
                  <td>{row.modelName}</td>
                  <td>{row.partNo}</td>
                  <td className="cell--num">{formatNumber(row.qty)}</td>
                  <td>{row.etdTcTech}</td>
                  <td>{row.etdPort}</td>
                  <td>{row.etaPort}</td>
                  <td>
                    <span className={`status-pill status-pill--${row.delayed ? 'delay' : 'ok'}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
