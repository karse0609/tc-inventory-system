import * as XLSX from 'xlsx'
import { getWeekRange } from './logisticsMetrics'

const PILOT_PART = 'Pilot Item'
const SOURCE_EXCEL = 'Excel Upload'
const KEY_SEP = '\x1e'

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

/** 로컬 달력 기준 YYYY-MM-DD (Excel JS Date / GMT+9 등 대응) */
export function formatLocalYMD(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) {
      const date = new Date(parsed.y, parsed.m - 1, parsed.d)
      return formatLocalYMD(date)
    }
  }
  const text = String(value ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const parsed = Date.parse(text)
  if (!Number.isNaN(parsed)) {
    return formatLocalYMD(new Date(parsed))
  }
  return ''
}

/**
 * 헤더 셀이 날짜(주차 컬럼)인지 판별 → YYYY-MM-DD 또는 null
 */
export function tryParseDateHeader(cell) {
  const ymd = formatLocalYMD(cell)
  return ymd || null
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const cleaned = String(value).replace(/,/g, '').trim()
  if (cleaned === '') return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * 상단 여러 행을 훑어 열마다 마지막으로 파싱된 날짜를 헤더로 사용 (2행 헤더·날짜 하단 배치 대응)
 */
function collectDateColumnsSingle(headerRow, headerRowIndex = 0) {
  const dateColumns = []
  const row = headerRow ?? []
  for (let col = 0; col < row.length; col += 1) {
    const iso = tryParseDateHeader(row[col])
    if (iso) {
      dateColumns.push({
        col,
        iso,
        header: headerText(row[col]),
        headerRow: headerRowIndex,
      })
    }
  }
  return dateColumns
}

function collectDateColumnsFromBand(rows, maxHeaderRow = 8) {
  const latest = new Map()
  const limit = Math.min(rows.length, maxHeaderRow + 1)
  for (let r = 0; r < limit; r += 1) {
    const row = rows[r] ?? []
    for (let col = 0; col < row.length; col += 1) {
      const iso = tryParseDateHeader(row[col])
      if (iso) {
        latest.set(col, {
          col,
          iso,
          header: headerText(row[col]),
          headerRow: r,
        })
      }
    }
  }
  return Array.from(latest.values()).sort((a, b) => a.col - b.col)
}

function findPartColumnIndex(headers) {
  for (let i = 0; i < headers.length; i += 1) {
    const k = normalizeKey(headers[i])
    if (!k) continue
    if (
      /partno|partnumber|품번|자재|itemcode|itemno|sku|material/.test(k) &&
      !/date|week|주차|forecast|ship/.test(k)
    ) {
      return i
    }
  }
  return -1
}

function detectRowMode(metaValues) {
  const joined = metaValues.map((v) => String(v ?? '').toLowerCase()).join(' ')
  if (/confirm|확정|confirmed/.test(joined)) return 'confirmed'
  if (/forecast|예측|계획|plan/.test(joined)) return 'planned'
  if (/shipment|선적|출하|배송상태|status/.test(joined)) return 'shipment'
  return 'planned'
}

function inferPartNoFromRow(row, metaIndices, partColIdx) {
  if (partColIdx >= 0) {
    const v = headerText(row[partColIdx])
    if (v) return v
  }
  for (const idx of metaIndices) {
    const cell = headerText(row[idx])
    if (/^PN[-\w]+$/i.test(cell) || /^[A-Z]{2,}\d+/i.test(cell)) return cell
  }
  return PILOT_PART
}

function maxWidth(rows) {
  return rows.reduce((m, row) => Math.max(m, (row ?? []).length), 0)
}

/**
 * 날짜 헤더가 없을 때: 우측 영역의 숫자 열을 주차별 계획으로 간주 (기준일 주의 월요일부터 순차 할당)
 */
function buildSyntheticDateColumns(rows, headerRowIndex, asOfDate) {
  if (!asOfDate || !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) return []
  const dataStart = headerRowIndex + 1
  const w = maxWidth(rows)
  const { start: mondayStr } = getWeekRange(asOfDate)
  const base = new Date(`${mondayStr}T12:00:00`)
  if (Number.isNaN(base.getTime())) return []

  const numericCols = []
  for (let col = 1; col < w; col += 1) {
    let numeric = 0
    let total = 0
    for (let r = dataStart; r < Math.min(rows.length, dataStart + 30); r += 1) {
      const n = toNumber(rows[r]?.[col])
      total += 1
      if (n !== null) numeric += 1
    }
    if (total >= 3 && numeric / total >= 0.4) numericCols.push(col)
  }

  return numericCols.map((col, i) => {
    const d = new Date(base)
    d.setDate(d.getDate() + i * 7)
    const iso = formatLocalYMD(d)
    return { col, iso, header: `Synthetic week ${i + 1}`, headerRow: headerRowIndex, synthetic: true }
  })
}

/**
 * Wide format: 헤더 대역에서 날짜 열 식별, 행 메타로 Forecast / Confirmed / Shipment 구분
 * @param {unknown[][]} rows
 * @param {string} modelName
 * @param {string} sheetName
 * @param {{ asOfDate?: string }} [options]
 */
export function parseWideFormatItemDeliveryPlans(rows, modelName, sheetName, options = {}) {
  const { asOfDate } = options
  const steps = []
  const addStep = (id, label, ok, detail = '') => {
    steps.push({ id, label, ok, detail })
  }

  addStep('sheet', 'Sheet detected', true, sheetName)

  if (!rows?.length) {
    addStep('header', 'Header row detected', false, 'Empty sheet')
    return { itemDeliveryPlans: [], steps, dateColumns: [], headerRowIndex: 1, previewRows: [] }
  }

  let dateColumns = collectDateColumnsFromBand(rows)
  let headerRowIndex
  if (dateColumns.length) {
    headerRowIndex = Math.max(...dateColumns.map((d) => d.headerRow))
  } else {
    let best = 0
    let bestCount = -1
    for (let r = 0; r < Math.min(rows.length, 6); r += 1) {
      const row = rows[r] ?? []
      let c = 0
      for (let col = 0; col < row.length; col += 1) {
        if (tryParseDateHeader(row[col])) c += 1
      }
      if (c > bestCount) {
        bestCount = c
        best = r
      }
    }
    headerRowIndex = best
    dateColumns = collectDateColumnsSingle(rows[headerRowIndex] ?? [], headerRowIndex)
  }

  let usedFallbackDates = false
  if (dateColumns.length === 0 && asOfDate) {
    dateColumns = buildSyntheticDateColumns(rows, headerRowIndex, asOfDate)
    usedFallbackDates = dateColumns.length > 0
  }

  const headerRow = rows[headerRowIndex] ?? []
  const mergedWidth = maxWidth(rows.slice(0, headerRowIndex + 1))
  const mergedHeaders = []
  for (let c = 0; c < mergedWidth; c += 1) {
    const parts = []
    for (let r = 0; r <= headerRowIndex; r += 1) {
      const t = headerText(rows[r]?.[c])
      if (t) parts.push(t)
    }
    mergedHeaders[c] = parts.join(' ')
  }
  const headers = mergedHeaders.length ? mergedHeaders : headerRow.map((c) => headerText(c))
  addStep(
    'header',
    'Header row detected',
    true,
    `Row ${headerRowIndex + 1} (${headers.filter(Boolean).length} cols)`,
  )

  addStep(
    'dates',
    'Date columns detected',
    dateColumns.length > 0,
    dateColumns.length
      ? `${dateColumns.map((d) => d.iso).join(', ')}${usedFallbackDates ? ' (positional fallback)' : ''}`
      : 'None',
  )

  const partColIdx = findPartColumnIndex(headers)
  const dateColSet = new Set(dateColumns.map((d) => d.col))
  const metaIndices = []
  for (let i = 0; i < Math.max(headers.length, maxWidth(rows)); i += 1) {
    if (!dateColSet.has(i)) metaIndices.push(i)
  }

  const merge = new Map()
  const dataStart = headerRowIndex + 1

  for (let r = dataStart; r < rows.length; r += 1) {
    const row = rows[r] ?? []
    const metaVals = metaIndices.map((i) => row[i])
    const mode = detectRowMode(metaVals)
    const partNo = inferPartNoFromRow(row, metaIndices, partColIdx)

    for (const { col, iso } of dateColumns) {
      const num = toNumber(row[col])
      if (num === null) continue
      const key = `${partNo}${KEY_SEP}${iso}`
      if (!merge.has(key)) merge.set(key, { planned: 0, confirmed: null })
      const cell = merge.get(key)
      if (mode === 'confirmed' || mode === 'shipment') {
        cell.confirmed = (cell.confirmed ?? 0) + num
      } else {
        cell.planned += num
      }
    }
  }

  const itemDeliveryPlans = []
  for (const [key, cell] of merge) {
    const sep = key.indexOf(KEY_SEP)
    const partNo = sep >= 0 ? key.slice(0, sep) : key
    const weekStartDate = sep >= 0 ? key.slice(sep + KEY_SEP.length) : ''
    if (!weekStartDate) continue
    const planned = cell.planned || 0
    const confirmed = cell.confirmed
    const cPart = confirmed != null && !Number.isNaN(Number(confirmed)) ? Number(confirmed) || 0 : 0
    const qty = planned + cPart
    itemDeliveryPlans.push({
      modelName,
      partNo: partNo || PILOT_PART,
      weekStartDate,
      qty,
      source: SOURCE_EXCEL,
    })
  }

  itemDeliveryPlans.sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate))

  addStep(
    'convert',
    'Weekly delivery data converted',
    true,
    `${itemDeliveryPlans.length} plan rows`,
  )

  return {
    itemDeliveryPlans,
    steps,
    dateColumns: dateColumns.map((d) => d.iso),
    headerRowIndex: headerRowIndex + 1,
    previewRows: itemDeliveryPlans.slice(0, 20),
    usedSyntheticDates: usedFallbackDates,
  }
}
