/**
 * Shipment Schedule Excel (Sheet: ML and Redmond) → In-Transit 행
 */

import * as XLSX from 'xlsx'
import { formatLocalYMD } from './parseExcelWideFormat'
import { newId } from './newId'
import { TRANSIT_ROW_STATUS } from './inTransitStatus'
import { normalizeModel } from './modelName'

export class ParseShipmentScheduleError extends Error {
  constructor(message, debug = {}) {
    super(message)
    this.name = 'ParseShipmentScheduleError'
    this.debug = debug
  }
}

function normalizeHeader(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function findCol(headers, matchers) {
  const n = headers.map(normalizeHeader)
  for (let i = 0; i < n.length; i += 1) {
    const cell = n[i]
    for (const m of matchers) {
      if (typeof m === 'string' && cell === m) return i
      if (m instanceof RegExp && m.test(cell)) return i
    }
  }
  return -1
}

function findSheet(workbook) {
  const names = workbook.SheetNames ?? []
  const norm = (n) =>
    String(n ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
  const exact = names.find((n) => norm(n) === 'ml and redmond')
  if (exact) return exact
  return (
    names.find((n) => {
      const s = norm(n)
      return s.includes('ml') && s.includes('redmond')
    }) ?? null
  )
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const cleaned = String(value).replace(/,/g, '').trim()
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function cellDate(value) {
  const ymd = formatLocalYMD(value)
  return ymd || String(value ?? '').trim()
}

function buildRowFromCells(cells, idx) {
  const v = (i) => (i >= 0 ? cells[i] : '')
  return {
    id: newId('tr'),
    containerNo: String(v(idx.container) ?? '').trim(),
    modelName: normalizeModel(v(idx.model)),
    partNo: String(v(idx.part) ?? '').trim(),
    qty: toNumber(v(idx.qty)),
    etdTcTech: cellDate(v(idx.etdTc)),
    etdPort: cellDate(v(idx.etdPort)),
    etaPort: cellDate(v(idx.etaPort)),
    etaWh: cellDate(v(idx.etaWh)) || String(v(idx.etaWh) ?? '').trim(),
    deliveryLocation: String(v(idx.delivery) ?? '').trim(),
    remark: String(v(idx.remark) ?? '').trim(),
    arrived: false,
    tcTechNo: String(v(idx.tcTech) ?? '').trim(),
    transitStatus: TRANSIT_ROW_STATUS.IN_TRANSIT,
    receiptDate: '',
    receivedBy: '',
    receivedAtIso: '',
  }
}

/**
 * @param {ArrayBuffer} buffer
 * @returns {{ rows: object[], sheetName: string }}
 */
export function parseShipmentScheduleExcel(buffer) {
  let workbook
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  } catch {
    throw new ParseShipmentScheduleError(
      'Excel 파일을 읽을 수 없습니다. .xlsx / .xls 형식인지 확인해 주세요.',
    )
  }

  const sheetName = findSheet(workbook)
  if (!sheetName) {
    throw new ParseShipmentScheduleError(
      '"ML and Redmond" 시트를 찾을 수 없습니다. 시트 이름을 확인해 주세요.',
      { workbookSheets: workbook.SheetNames },
    )
  }

  const sheet = workbook.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  if (!raw.length) {
    throw new ParseShipmentScheduleError('시트가 비어 있습니다.', { sheetName })
  }

  const headerRow = raw[0] ?? []
  const headers = headerRow.map((c) => String(c ?? ''))

  const idx = {
    container: findCol(headers, ['container #', 'container', /^container/]),
    model: findCol(headers, ['model', /^model$/]),
    part: findCol(headers, ['part no', 'part no.', 'partno', 'part number', /^part/]),
    qty: findCol(headers, ['qtys', 'qty', 'quantity', /^qty/]),
    etdTc: findCol(headers, ['etd tc tech', 'etd tc', /^etd tc/]),
    etdPort: findCol(headers, ['etd busan', 'etd port', /^etd port/, /^etd busan/]),
    etaPort: findCol(headers, ['eta port', /^eta port$/]),
    etaWh: findCol(headers, [
      'revised eta',
      'eta w/h',
      'etawh',
      'eta wh',
      /^revised eta/,
      /^eta\s*w\/?h/,
    ]),
    delivery: findCol(headers, ['delivery location', 'delivery', /^delivery location/]),
    remark: findCol(headers, ['remark', '비고', /^remark/, /^비고/]),
    tcTech: findCol(headers, ['tc tech no.', 'tc tech no', 'tc techno', /^tc tech/]),
  }

  if (idx.container < 0 && idx.part < 0) {
    throw new ParseShipmentScheduleError(
      '필수 열(Container # / Part no.)을 찾을 수 없습니다.',
      { sheetName, headers },
    )
  }

  const rows = []
  for (let r = 1; r < raw.length; r += 1) {
    const line = raw[r] ?? []
    if (!line.some((c) => String(c ?? '').trim() !== '')) continue
    const row = buildRowFromCells(line, idx)
    if (!row.containerNo && !row.partNo && !row.modelName) continue
    rows.push(row)
  }

  if (!rows.length) {
    throw new ParseShipmentScheduleError('데이터 행이 없습니다.', { sheetName, headers })
  }

  return { rows, sheetName }
}
