import BilingualLabel from '../BilingualLabel'
import { L } from '../../i18n/labels'
import './mobile-shell.css'

function formatQty(n) {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0))
}

/**
 * 모바일 창고 재고 — 카드 리스트 (조회 전용, Master Current Stock 그대로)
 */
export default function MobileWarehouseCards({ masterItems, unitLabel = 'EA' }) {
  const rows = (masterItems || []).filter((m) => m.status !== 'Inactive')

  if (!rows.length) {
    return (
      <>
        <h1 className="mobile-page-title">
          <BilingualLabel label={L.warehouseInventoryScreen} as="span" />
        </h1>
        <p className="mobile-empty">
          <BilingualLabel label={L.mobileWarehouseEmpty} as="span" />
        </p>
      </>
    )
  }

  return (
    <>
      <h1 className="mobile-page-title">
        <BilingualLabel label={L.warehouseInventoryScreen} as="span" />
      </h1>
      <p className="mobile-hint" style={{ marginBottom: '0.65rem' }}>
        <BilingualLabel label={L.mobileWarehouseReadOnly} as="span" compact />
      </p>
      <ul className="mobile-list">
        {rows.map((row) => (
          <li key={row.id} className="mobile-line-card">
            <div className="mobile-line-card__row">
              <div>
                <div className="mobile-line-card__model">{row.modelName || '—'}</div>
                <div className="mobile-line-card__part">{row.partNo || '—'}</div>
              </div>
              <div className="mobile-line-card__qty">{formatQty(row.currentStock)}</div>
            </div>
            <dl className="mobile-line-card__meta">
              <dt>
                <BilingualLabel label={L.description} as="span" compact />
              </dt>
              <dd style={{ gridColumn: '2 / -1' }}>{row.description || '—'}</dd>
              <dt>
                <BilingualLabel label={L.currentStock} as="span" compact />
              </dt>
              <dd>
                {formatQty(row.currentStock)} {unitLabel}
              </dd>
            </dl>
          </li>
        ))}
      </ul>
    </>
  )
}
