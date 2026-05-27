import { newId } from './newId'
import { normalizeTransitStatus, TRANSIT_ROW_STATUS } from './inTransitStatus'

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
      transitStatus: TRANSIT_ROW_STATUS.IN_TRANSIT,
      receiptDate: '',
      receivedBy: '',
      receivedAtIso: '',
    }
  }

  const {
    status,
    delayed,
    delayReason,
    forwarder,
    hbl,
    ...rest
  } = row
  void delayed
  void forwarder
  void hbl

  const transitStatus = normalizeTransitStatus(row.transitStatus)

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
    transitStatus,
    receiptDate: String(row.receiptDate ?? '').trim(),
    receivedBy: String(row.receivedBy ?? '').trim(),
    receivedAtIso: String(row.receivedAtIso ?? row.receivedAt ?? '').trim(),
  }
}

export function migrateInTransitRows(rows) {
  if (!Array.isArray(rows)) return []
  return rows.map(migrateInTransitRow)
}
