import * as XLSX from 'xlsx'
import { getKoreaCalendarDate } from './timeZones'

/** @param {string} fileBase e.g. WarehouseInventory */
export function buildDatedXlsxFilename(fileBase) {
  const safe = String(fileBase || 'Export').replace(/[^\w\-]+/g, '_')
  const d = getKoreaCalendarDate()
  return `${safe}_${d}.xlsx`
}

/**
 * @param {string} fileBase filename without extension
 * @param {string} sheetName max 31 chars for Excel
 * @param {(string|number|null|undefined)[][]} aoa
 */
export function downloadXlsxFromAoA(fileBase, sheetName, aoa) {
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  const sn = String(sheetName || 'Data').slice(0, 31) || 'Sheet1'
  XLSX.utils.book_append_sheet(wb, ws, sn)
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = buildDatedXlsxFilename(fileBase)
  a.click()
  URL.revokeObjectURL(a.href)
}

/** @param {File} file */
export async function readXlsxFirstSheetMatrix(file) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const name = workbook.SheetNames?.[0]
  if (!name) return []
  const sheet = workbook.Sheets[name]
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
}
