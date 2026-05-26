import BilingualLabel from './BilingualLabel'
import { L } from '../i18n/labels'
import './InventoryChart.css'

const CHART = {
  width: 640,
  height: 220,
  padding: { top: 24, right: 24, bottom: 40, left: 56 },
}

function formatNumber(value) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value))
}

function buildPoints(series, innerWidth, innerHeight, minY, maxY) {
  const span = maxY - minY || 1
  return series.map((row, index) => {
    const x =
      CHART.padding.left +
      (index / Math.max(series.length - 1, 1)) * innerWidth
    const y =
      CHART.padding.top +
      innerHeight -
      ((row.inventory - minY) / span) * innerHeight
    return { x, y, row }
  })
}

export default function InventoryChart({ series, safetyStock }) {
  const innerWidth =
    CHART.width - CHART.padding.left - CHART.padding.right
  const innerHeight =
    CHART.height - CHART.padding.top - CHART.padding.bottom

  const inventories = series.map((row) => row.inventory)
  const minY = Math.min(safetyStock, ...inventories) * 0.92
  const maxY = Math.max(safetyStock, ...inventories) * 1.05
  const points = buildPoints(series, innerWidth, innerHeight, minY, maxY)

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  const areaPath = `${linePath} L ${points.at(-1)?.x ?? 0} ${
    CHART.padding.top + innerHeight
  } L ${points[0]?.x ?? 0} ${CHART.padding.top + innerHeight} Z`

  const safetyY =
    CHART.padding.top +
    innerHeight -
    ((safetyStock - minY) / (maxY - minY || 1)) * innerHeight

  const yTicks = 4
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, index) => {
    return minY + ((maxY - minY) * index) / yTicks
  })

  return (
    <div className="inventory-chart">
      <div className="inventory-chart__header">
        <h3>
          <BilingualLabel label={L.inventoryTrend} as="span" />
        </h3>
        <p className="inventory-chart__formula">
          {L.formula.ko}
          <span className="inventory-chart__formula-en"> · {L.formula.en}</span>
        </p>
      </div>
      <div className="inventory-chart__canvas">
        <svg
          viewBox={`0 0 ${CHART.width} ${CHART.height}`}
          role="img"
          aria-label="Weekly inventory trend chart"
        >
          {yTickValues.map((value) => {
            const y =
              CHART.padding.top +
              innerHeight -
              ((value - minY) / (maxY - minY || 1)) * innerHeight
            return (
              <g key={value} className="inventory-chart__grid">
                <line
                  x1={CHART.padding.left}
                  y1={y}
                  x2={CHART.width - CHART.padding.right}
                  y2={y}
                />
                <text x={CHART.padding.left - 10} y={y + 4} textAnchor="end">
                  {formatNumber(value)}
                </text>
              </g>
            )
          })}

          <line
            className="inventory-chart__safety"
            x1={CHART.padding.left}
            y1={safetyY}
            x2={CHART.width - CHART.padding.right}
            y2={safetyY}
          />
          <text
            className="inventory-chart__safety-label"
            x={CHART.width - CHART.padding.right}
            y={safetyY - 6}
            textAnchor="end"
          >
            {L.safetyStock.ko} ({L.safetyStock.en}) {formatNumber(safetyStock)}
          </text>

          <path className="inventory-chart__area" d={areaPath} />
          <path className="inventory-chart__line" d={linePath} />

          {points.map(({ x, y, row }) => (
            <g key={`${row.modelName}-${row.week}`} className="inventory-chart__point">
              <circle cx={x} cy={y} r={row.status === 'current' ? 6 : 4} />
              <text x={x} y={CHART.height - 12} textAnchor="middle">
                {row.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <ul className="inventory-chart__legend">
        <li>
          <span className="inventory-chart__swatch inventory-chart__swatch--line" />
          <BilingualLabel label={L.weekEndInventory} as="span" />
        </li>
        <li>
          <span className="inventory-chart__swatch inventory-chart__swatch--safety" />
          <BilingualLabel label={L.safetyStock} as="span" />
        </li>
      </ul>
    </div>
  )
}
