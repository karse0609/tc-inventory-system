import { filterByModel, planRowWeekStart } from './logisticsMetrics'
import { skuCostKey } from './unitCostKrw'

/**
 * @typedef {{ modelName: string, partNo: string, qty: number, receivedAt: string }} ArrivalLedgerEntry
 */

/** 납품 계획 누적 출고: 주 시작일(월) ≤ through 일까지 합계 */
export function sumOutboundThroughDate(plans, modelName, partNo, throughInclusive) {
  if (!throughInclusive) return 0
  let sum = 0
  for (const row of plans) {
    if (row.modelName !== modelName || row.partNo !== partNo) continue
    const w = planRowWeekStart(row)
    if (!w || w > throughInclusive) continue
    sum += Number(row.qty ?? row.plannedQty) || 0
  }
  return sum
}

function sumArrivalsBetweenExclusiveToInclusive(ledger, modelName, partNo, fromExclusive, toInclusive) {
  if (!Array.isArray(ledger) || !toInclusive) return 0
  let sum = 0
  for (const e of ledger) {
    if (e.modelName !== modelName || e.partNo !== partNo) continue
    const ra = String(e.receivedAt ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ra)) continue
    if (ra <= fromExclusive) continue
    if (ra > toInclusive) continue
    sum += Math.max(0, Number(e.qty) || 0)
  }
  return sum
}

/**
 * 기준일 시점 창고 재고(수량) — 현재 마스터 재고를 앵커로 역산.
 * W(asOf) = W(기준앵커) − 입고(기준일~앵커] + 출고(기준일~앵커]
 * 앵커(referenceDate)는 보통 접속일(Seattle 달력).
 */
export function computeWarehouseQtyAsOf({
  item,
  deliveryPlans,
  arrivalLedger,
  asOfDate,
  referenceDate,
}) {
  const wNow = Number(item.currentStock) || 0
  const ref = String(referenceDate || '').trim()
  const asOf = String(asOfDate || '').trim()
  if (!ref || !asOf || !/^\d{4}-\d{2}-\d{2}$/.test(ref) || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    return wNow
  }
  if (asOf >= ref) return wNow

  const m = item.modelName
  const p = item.partNo
  const arrivals = sumArrivalsBetweenExclusiveToInclusive(arrivalLedger || [], m, p, asOf, ref)
  const oRef = sumOutboundThroughDate(deliveryPlans, m, p, ref)
  const oAsOf = sumOutboundThroughDate(deliveryPlans, m, p, asOf)
  const outboundDelta = oRef - oAsOf
  return Math.max(0, wNow - arrivals + outboundDelta)
}

export function sumWarehouseStockForModelWithAsOf(
  masterItems,
  modelName,
  unitCostKrwBySku,
  deliveryPlans,
  arrivalLedger,
  asOfDate,
  referenceDate,
) {
  const rows = filterByModel(masterItems, modelName).filter((r) => r.status !== 'Inactive')
  const map = unitCostKrwBySku && typeof unitCostKrwBySku === 'object' ? unitCostKrwBySku : {}
  let qty = 0
  let value = 0
  for (const r of rows) {
    const q = computeWarehouseQtyAsOf({
      item: r,
      deliveryPlans,
      arrivalLedger,
      asOfDate,
      referenceDate,
    })
    const cost = Math.max(0, Number(map[skuCostKey(r.modelName, r.partNo)]) || 0)
    qty += q
    value += q * cost
  }
  return { qty, value }
}

/** 입고 확정 시 ledger에 넣을 receivedAt (YYYY-MM-DD) */
export function resolveReceiptDateForLedger(row, fallbackIsoDate) {
  const wh = String(row?.etaWh ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(wh)) return wh
  const port = String(row?.etaPort ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(port)) return port
  const fb = String(fallbackIsoDate ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(fb)) return fb
  return new Date().toISOString().slice(0, 10)
}
