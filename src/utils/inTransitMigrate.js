import { newId } from './newId'

/**
 * localStorage 등 레거시 In-Transit 행 → 현재 스키마
 * (status/delayed/delayReason → deliveryLocation/remark 등)
 */
export function migrateInTransitRow(row) {
  if (!row || typeof row !== 'object') {
    return {
      id: newId('tr'),
      containerNo: '',
      modelName: '',
      partNo: '',
      qty: 0,
      etdTcTech: '',
      etdPort: '',
      etaPort: '',
      etaWh: '',
      deliveryLocation: '',
      remark: '',
      arrived: false,
      forwarder: '',
      hbl: '',
      tcTechNo: '',
    }
  }

  const {
    status,
    delayed: _delayed,
    delayReason,
    ...rest
  } = row

  return {
    ...rest,
    id: row.id ?? newId('tr-mig'),
    deliveryLocation: row.deliveryLocation ?? status ?? '',
    remark: row.remark ?? delayReason ?? '',
    etaWh: row.etaWh ?? '',
    arrived: !!row.arrived,
    forwarder: row.forwarder ?? '',
    hbl: row.hbl ?? '',
    tcTechNo: row.tcTechNo ?? '',
  }
}

export function migrateInTransitRows(rows) {
  if (!Array.isArray(rows)) return []
  return rows.map(migrateInTransitRow)
}
