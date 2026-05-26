import * as XLSX from 'xlsx'
import { getExcelSheetName, PILOT_MODEL_NAME } from '../config/products'
import { parseWideFormatItemDeliveryPlans } from './parseExcelWideFormat'

/**
 * 제품/주차 형식 Excel 파싱 (Pilot 시트 등).
 * 현재 앱 네비에는 연결된 화면 없음 — 출고 예측 업로드 재도입 시 이 모듈 + `forecastMerge.buildForecastApplyPreview` 사용.
 */

/** @deprecated GS30E — Pilot 시트명은 GS1930E */
export const GS30E_SHEET_NAME = 'GS30E'

/** Pilot Excel 시트명 */
export const PRODUCT_EXCEL_SHEET_NAME = getExcelSheetName(PILOT_MODEL_NAME)

export const HEADER_SCAN_ROWS = 20

const REQUIRED_FIELDS = ['oeiInbound', 'weeklyOutbound']
const WEEK_FIELDS = ['week', 'periodStart']

/** @type {Record<string, { label: string, matchers: { score: number, test: (header: string, key: string) => boolean }[] }>} */
const FIELD_DEFINITIONS = {
  week: {
    label: '주차',
    matchers: [
      { score: 100, test: (_, key) => key === '주차' || key === 'week' || key === 'weekno' },
      { score: 95, test: (h) => /주차/i.test(h) },
      { score: 92, test: (_, key) => key === 'week' || key === 'weeks' },
      { score: 88, test: (_, key) => key === 'date' },
      { score: 82, test: (_, key) => key === '시작일' || key === 'startdate' },
      { score: 75, test: (h, key) => key.includes('week') || /week/i.test(h) },
    ],
  },
  periodStart: {
    label: '시작일',
    matchers: [
      { score: 90, test: (_, key) => key === '시작일' || key === 'periodstart' || key === 'startdate' },
      { score: 85, test: (_, key) => key === 'date' || key === '일자' },
      { score: 80, test: (h) => /기간|period/i.test(h) && !/week|주차/i.test(h) },
    ],
  },
  tcShipment: {
    label: 'TC선적',
    matchers: [
      { score: 100, test: (_, key) => key.includes('tc선적') || key === 'tcshipment' },
      { score: 95, test: (h) => /tc\s*선적|tcshipment/i.test(h) },
      { score: 88, test: (_, key) => key === 'tc' },
      { score: 82, test: (_, key) => key === 'shipment' || key === '선적' },
      { score: 70, test: (h, key) => key.startsWith('tc') && key.length <= 4 },
    ],
  },
  oeiInbound: {
    label: 'OEI입고',
    matchers: [
      { score: 100, test: (_, key) => key.includes('oei입고') || key === 'oeiinbound' },
      { score: 95, test: (_, key) => key === 'oei' },
      { score: 90, test: (h) => /oei\s*입고|oei\s*inbound/i.test(h) },
      { score: 82, test: (_, key) => key === '입고' && !key.includes('nci') },
      { score: 78, test: (_, key) => key.includes('oei') && !key.includes('nci') },
    ],
  },
  weeklyOutbound: {
    label: '주간출고',
    matchers: [
      {
        score: 100,
        test: (_, key) =>
          key.includes('주간출고') || key === 'weeklyout' || key === 'weeklydelivery',
      },
      { score: 95, test: (h) => /weekly\s*out|weekly\s*deliver/i.test(h) },
      { score: 88, test: (_, key) => key === '출고' && !key.includes('입고') },
      { score: 85, test: (h) => /주간\s*출고/i.test(h) },
      { score: 75, test: (h) => /weekly/i.test(h) && /out|deliver|ship/i.test(h) },
    ],
  },
  nci: {
    label: 'NCI',
    matchers: [
      { score: 100, test: (_, key) => key.includes('nci입고') },
      { score: 95, test: (_, key) => key === 'nci' },
      { score: 90, test: (h) => /^nci$/i.test(String(h).trim()) },
    ],
  },
  label: {
    label: '라벨',
    matchers: [
      { score: 80, test: (_, key) => key === 'label' || key === '라벨' || key === '주차명' },
    ],
  },
  planNote: {
    label: '메모',
    matchers: [
      { score: 80, test: (_, key) => ['메모', '비고', 'note', 'remark', '계획'].includes(key) },
    ],
  },
  status: {
    label: '상태',
    matchers: [{ score: 80, test: (_, key) => key === 'status' || key === '상태' }],
  },
  startingInventory: {
    label: '시작재고',
    matchers: [
      { score: 100, test: (_, key) => key.includes('시작재고') || key === 'initialinventory' },
    ],
  },
}

export class ParseProductExcelError extends Error {
  /** @param {string} message @param {object} debug */
  constructor(message, debug = {}) {
    super(message)
    this.name = 'ParseProductExcelError'
    this.debug = debug
  }
}

/** @deprecated */
export const ParseGs30eError = ParseProductExcelError

function normalizeKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[_-]/g, '')
}

function headerText(value) {
  return String(value ?? '').trim()
}

function scoreHeaderForField(header) {
  const text = headerText(header)
  const key = normalizeKey(header)
  if (!key && !text) return null

  let best = { field: null, score: 0 }

  for (const [field, definition] of Object.entries(FIELD_DEFINITIONS)) {
    for (const matcher of definition.matchers) {
      if (matcher.test(text, key) && matcher.score > best.score) {
        best = { field, score: matcher.score }
      }
    }
  }

  return best.score > 0 ? best : null
}

function mapColumnsByScore(headers) {
  const candidates = []

  headers.forEach((header, index) => {
    const match = scoreHeaderForField(header)
    if (match) {
      candidates.push({ index, header: headerText(header), ...match })
    }
  })

  candidates.sort((a, b) => b.score - a.score)

  const columnMap = {}
  const usedIndices = new Set()

  for (const candidate of candidates) {
    if (usedIndices.has(candidate.index)) continue
    if (columnMap[candidate.field] !== undefined) continue
    columnMap[candidate.field] = candidate.index
    usedIndices.add(candidate.index)
  }

  return columnMap
}

function scoreHeaderRow(headers) {
  const columnMap = mapColumnsByScore(headers)
  const hasWeek = WEEK_FIELDS.some((field) => columnMap[field] !== undefined)
  const hasRequired = REQUIRED_FIELDS.every((field) => columnMap[field] !== undefined)

  let score = 0
  for (const field of Object.keys(columnMap)) {
    const header = headers[columnMap[field]]
    const match = scoreHeaderForField(header)
    if (match) score += match.score
  }

  const nonEmptyHeaders = headers.filter((h) => headerText(h)).length
  if (nonEmptyHeaders >= 3) score += 10

  return { rowScore: score, columnMap, hasWeek, hasRequired, nonEmptyHeaders }
}

function padRows(rows, scanRows = HEADER_SCAN_ROWS) {
  const maxCols = rows
    .slice(0, scanRows)
    .reduce((max, row) => Math.max(max, (row ?? []).length), 0)

  return rows.map((row) => {
    const padded = [...(row ?? [])]
    while (padded.length < maxCols) padded.push('')
    return padded
  })
}

function collectRowColumns(rows, scanRows = HEADER_SCAN_ROWS) {
  return rows.slice(0, scanRows).map((row, rowIndex) => ({
    rowIndex: rowIndex + 1,
    columns: (row ?? []).map((cell) => headerText(cell)).filter(Boolean),
  }))
}

function logProductSheetColumns(sheetName, rows, modelName) {
  const rowColumns = collectRowColumns(rows)
  const allNames = [...new Set(rowColumns.flatMap((row) => row.columns))]

  console.group(
    `[${modelName}] 시트 "${sheetName}" 컬럼 탐색 (상위 ${HEADER_SCAN_ROWS}행)`,
  )
  rowColumns.forEach(({ rowIndex, columns }) => {
    if (columns.length) {
      console.log(`  ${rowIndex}행:`, columns)
    }
  })
  console.log(`[${modelName}] 전체 감지 컬럼명:`, allNames)
  console.groupEnd()

  return { rowColumns, allColumnNames: allNames }
}

function findHeaderRow(rows) {
  let best = null

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, HEADER_SCAN_ROWS); rowIndex += 1) {
    const row = rows[rowIndex] ?? []
    const headers = row.map((cell) => headerText(cell))
    const result = scoreHeaderRow(headers)

    if (result.hasRequired && result.hasWeek && result.nonEmptyHeaders >= 2) {
      if (!best || result.rowScore > best.rowScore) {
        best = { rowIndex, headers, ...result }
      }
    }
  }

  // 필수 열(OEI·출고)만 있으면 주차 열 없이 첫 열을 week 후보로 허용
  if (!best) {
    for (let rowIndex = 0; rowIndex < Math.min(rows.length, HEADER_SCAN_ROWS); rowIndex += 1) {
      const row = rows[rowIndex] ?? []
      const headers = row.map((cell) => headerText(cell))
      const result = scoreHeaderRow(headers)

      if (result.hasRequired && result.nonEmptyHeaders >= 2) {
        const columnMap = { ...result.columnMap }
        if (!WEEK_FIELDS.some((field) => columnMap[field] !== undefined)) {
          const firstTextIndex = headers.findIndex((h) => headerText(h))
          if (firstTextIndex >= 0) columnMap.week = firstTextIndex
        }
        if (WEEK_FIELDS.some((field) => columnMap[field] !== undefined)) {
          const relaxed = { ...result, rowIndex, headers, columnMap, hasWeek: true }
          if (!best || relaxed.rowScore > best.rowScore) best = relaxed
        }
      }
    }
  }

  return best
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const cleaned = String(value).replace(/,/g, '').trim()
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : NaN
}

function parseStatus(value, index, total) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw.includes('완료') || raw === 'completed') return 'completed'
  if (raw.includes('진행') || raw === 'current') return 'current'
  if (raw.includes('계획') || raw === 'planned') return 'planned'
  if (index === total - 1) return 'current'
  if (index < total - 2) return 'completed'
  return 'planned'
}

function formatExcelDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) {
      const date = new Date(parsed.y, parsed.m - 1, parsed.d)
      return date.toISOString().slice(0, 10)
    }
  }
  const text = String(value ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  return text || ''
}

function findSheet(workbook, targetSheetName) {
  const exact = workbook.SheetNames.find(
    (name) => normalizeKey(name) === normalizeKey(targetSheetName),
  )
  if (exact) return exact

  const fuzzy = workbook.SheetNames.find((name) =>
    normalizeKey(name).includes(normalizeKey(targetSheetName)),
  )
  return fuzzy ?? null
}

function findStartingInventory(rows) {
  for (const row of rows) {
    if (!row?.length) continue
    const label = normalizeKey(row[0])
    const match = scoreHeaderForField(row[0])
    if (match?.field === 'startingInventory') {
      const value = toNumber(row[1])
      if (!Number.isNaN(value)) return value
    }
    if (label.includes('시작재고')) {
      const value = toNumber(row[1])
      if (!Number.isNaN(value)) return value
    }
  }
  return null
}

function buildWeekId(label, periodStart, index) {
  if (periodStart && /^\d{4}-\d{2}-\d{2}$/.test(periodStart)) {
    const date = new Date(`${periodStart}T00:00:00`)
    if (!Number.isNaN(date.getTime())) {
      const oneJan = new Date(date.getFullYear(), 0, 1)
      const week = Math.ceil(
        ((date - oneJan) / 86400000 + oneJan.getDay() + 1) / 7,
      )
      return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`
    }
  }
  return `UPLOAD-W${String(index + 1).padStart(2, '0')}`
}

function resolveWeekColumnIndex(columnMap) {
  if (columnMap.week !== undefined) return columnMap.week
  if (columnMap.periodStart !== undefined) return columnMap.periodStart
  return 0
}

function buildParseDebug(workbook, sheetName, rows, scanMeta) {
  return {
    sheetName: sheetName ?? null,
    workbookSheets: workbook?.SheetNames ?? [],
    allColumnNames: scanMeta?.allColumnNames ?? [],
    rowColumns: scanMeta?.rowColumns ?? [],
    scannedRows: HEADER_SCAN_ROWS,
  }
}

/**
 * itemDeliveryPlans(주차·품번) → Raw Data용 주간 시리즈 (출고 합계)
 */
function synthesizeWeeklyPlansFromItemDeliveryPlans(plans, modelName) {
  const map = new Map()
  for (const p of plans) {
    const start = p.weekStartDate || p.periodStart
    if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(String(start))) continue
    if (!map.has(start)) {
      map.set(start, {
        modelName,
        week: p.week,
        label: p.label,
        periodStart: start,
        tcShipment: 0,
        oeiInbound: 0,
        weeklyOutbound: 0,
        nci: 0,
        planNote: `Excel Upload · ${modelName} · ${p.label}`,
        status: 'planned',
      })
    }
    const w = map.get(start)
    w.weeklyOutbound += Number(p.qty ?? p.plannedQty) || 0
  }
  const sorted = [...map.values()].sort((a, b) => a.periodStart.localeCompare(b.periodStart))
  return sorted.map((row, index, arr) => ({
    ...row,
    status: parseStatus('', index, arr.length),
  }))
}

function buildSoftParseResult({
  workbook,
  sheetName,
  rows,
  scanMeta,
  modelName,
  wide,
  weeklyPlans = [],
  itemDeliveryPlans = [],
  warnings = [],
  columnMap = {},
}) {
  return {
    weeklyPlans,
    itemDeliveryPlans,
    startingInventory: findStartingInventory(rows),
    sheetName,
    modelName,
    columnMap,
    headerRowIndex: wide?.headerRowIndex ?? null,
    parseMode: 'wide',
    parseSteps: wide?.steps ?? [],
    previewRows: wide?.previewRows ?? [],
    warnings,
    debug: buildParseDebug(workbook, sheetName, rows, scanMeta),
  }
}

/**
 * 품목 Excel 시트에서 주간 계획 데이터 추출 (Pilot: GS1930E)
 * @param {ArrayBuffer} buffer
 * @param {{ modelName?: string, asOfDate?: string }} [options]
 */
export function parseProductExcel(buffer, options = {}) {
  const modelName = options.modelName ?? PILOT_MODEL_NAME
  const asOfDate = options.asOfDate
  const targetSheetName = getExcelSheetName(modelName)

  let workbook
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  } catch {
    throw new ParseProductExcelError(
      'Excel 파일을 읽을 수 없습니다. .xlsx / .xls 형식인지 확인해 주세요.',
    )
  }

  if (!workbook.SheetNames.length) {
    throw new ParseProductExcelError('워크북에 시트가 없습니다.', {
      workbookSheets: [],
      modelName,
      expectedSheetName: targetSheetName,
    })
  }

  const sheetName = findSheet(workbook, targetSheetName)
  if (!sheetName) {
    throw new ParseProductExcelError(
      `"${targetSheetName}" 시트를 찾을 수 없습니다. (모델: ${modelName})`,
      { ...buildParseDebug(workbook, null, []), modelName, expectedSheetName: targetSheetName },
    )
  }

  const sheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  const rows = padRows(rawRows)
  const scanMeta = logProductSheetColumns(sheetName, rows, modelName)

  if (!rows.length) {
    throw new ParseProductExcelError(
      `"${sheetName}" 시트가 비어 있습니다.`,
      buildParseDebug(workbook, sheetName, rows, scanMeta),
    )
  }

  const wide = parseWideFormatItemDeliveryPlans(rows, modelName, sheetName, { asOfDate })

  if (wide.itemDeliveryPlans.length > 0) {
    const weeklyPlans = synthesizeWeeklyPlansFromItemDeliveryPlans(
      wide.itemDeliveryPlans,
      modelName,
    )
    const startingInventory = findStartingInventory(rows)
    console.log(`[${modelName}] Wide format · rows:`, wide.itemDeliveryPlans.length)
    return {
      weeklyPlans,
      itemDeliveryPlans: wide.itemDeliveryPlans,
      startingInventory,
      sheetName,
      modelName,
      columnMap: {},
      headerRowIndex: wide.headerRowIndex,
      parseMode: 'wide',
      parseSteps: wide.steps,
      previewRows: wide.previewRows,
      warnings: [],
      debug: buildParseDebug(workbook, sheetName, rows, scanMeta),
    }
  }

  const headerInfo = findHeaderRow(rows)
  if (!headerInfo) {
    return buildSoftParseResult({
      workbook,
      sheetName,
      rows,
      scanMeta,
      modelName,
      wide,
      warnings: [
        'Legacy headers (OEI / weekly outbound) not found. Wide format did not yield delivery quantities — check date headers or numeric columns.',
      ],
    })
  }

  const columnMap = headerInfo.columnMap
  const weekCol = resolveWeekColumnIndex(columnMap)

  const missing = REQUIRED_FIELDS.filter((field) => columnMap[field] === undefined)
  if (missing.length) {
    const labels = Object.fromEntries(
      Object.entries(FIELD_DEFINITIONS).map(([k, v]) => [k, v.label]),
    )
    return buildSoftParseResult({
      workbook,
      sheetName,
      rows,
      scanMeta,
      modelName,
      wide,
      warnings: [`Legacy required columns missing: ${missing.map((f) => labels[f]).join(', ')}`],
    })
  }

  const dataRows = rows.slice(headerInfo.rowIndex + 1).filter((row) => {
    const weekCell = row[weekCol]
    return String(weekCell ?? '').trim() !== ''
  })

  if (!dataRows.length) {
    return buildSoftParseResult({
      workbook,
      sheetName,
      rows,
      scanMeta,
      modelName,
      wide,
      warnings: ['Legacy mode: no data rows below the detected header.'],
    })
  }

  const weeklyPlans = []

  try {
    dataRows.forEach((row, index) => {
      const weekCell = row[weekCol]
      const weekLabel = formatExcelDate(weekCell) || String(weekCell ?? '').trim()
      const oeiInbound = toNumber(row[columnMap.oeiInbound])
      const weeklyOutbound = toNumber(row[columnMap.weeklyOutbound])
      const nci = columnMap.nci !== undefined ? toNumber(row[columnMap.nci]) : 0
      const tcShipment =
        columnMap.tcShipment !== undefined ? toNumber(row[columnMap.tcShipment]) : 0

      if ([oeiInbound, weeklyOutbound, nci, tcShipment].some((n) => Number.isNaN(n))) {
        throw new ParseProductExcelError(
          `${weekLabel || `${index + 1}번째`} 행에 숫자가 아닌 값이 있습니다.`,
          buildParseDebug(workbook, sheetName, rows, scanMeta),
        )
      }

      const periodStart =
        columnMap.periodStart !== undefined && columnMap.periodStart !== weekCol
          ? formatExcelDate(row[columnMap.periodStart])
          : formatExcelDate(weekCell) || ''

      const label =
        columnMap.label !== undefined
          ? String(row[columnMap.label] ?? '').trim() || weekLabel
          : weekLabel

      const planNote =
        columnMap.planNote !== undefined
          ? String(row[columnMap.planNote] ?? '').trim()
          : ''

      const status =
        columnMap.status !== undefined
          ? parseStatus(row[columnMap.status], index, dataRows.length)
          : parseStatus('', index, dataRows.length)

      weeklyPlans.push({
        modelName,
        week: buildWeekId(weekLabel, periodStart, index),
        label,
        periodStart,
        tcShipment,
        oeiInbound,
        weeklyOutbound,
        nci,
        planNote: planNote || `Excel · ${modelName} · ${weekLabel}`,
        status,
      })
    })
  } catch (err) {
    if (err instanceof ParseProductExcelError) throw err
    throw err
  }

  const startingInventory = findStartingInventory(rows)

  console.log(`[${modelName}] 헤더 행:`, headerInfo.rowIndex + 1, '매핑:', columnMap)

  const itemDeliveryPlans = weeklyPlans
    .filter((w) => w.periodStart && /^\d{4}-\d{2}-\d{2}$/.test(String(w.periodStart)))
    .map((w) => ({
      modelName,
      partNo: 'Pilot Item',
      weekStartDate: w.periodStart,
      qty: Number(w.weeklyOutbound) || 0,
      source: 'Excel Upload',
    }))

  return {
    weeklyPlans,
    itemDeliveryPlans,
    startingInventory,
    sheetName,
    modelName,
    columnMap,
    headerRowIndex: headerInfo.rowIndex + 1,
    parseMode: 'legacy',
    parseSteps: wide.steps?.length
      ? [...wide.steps, { id: 'legacy', label: 'Legacy row format parsed', ok: true, detail: '' }]
      : [{ id: 'legacy', label: 'Legacy row format parsed', ok: true, detail: '' }],
    previewRows: itemDeliveryPlans.slice(0, 20),
    warnings: [],
    debug: buildParseDebug(workbook, sheetName, rows, scanMeta),
  }
}

/** @deprecated parseProductExcel 사용 */
export function parseGs30eExcel(buffer, options) {
  return parseProductExcel(buffer, options)
}
