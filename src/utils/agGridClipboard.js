import { splitTsvToMatrix } from './excelGridClipboard'

/** @param {string} text */
export function matrixFromClipboardText(text) {
  return splitTsvToMatrix(String(text ?? ''))
}

/**
 * @param {import('ag-grid-community').GridApi} api
 * @param {string[]} colIds editable / copyable column order (no checkbox / actions)
 */
export function copyGridSelectionAsTsv(api, colIds) {
  const rows = api.getSelectedRows()
  if (rows.length > 0) {
    const lines = rows.map((row) => colIds.map((id) => stringifyCellValue(row[id])).join('\t'))
    return lines.join('\n')
  }
  const focused = api.getFocusedCell()
  if (!focused) return ''
  const node = api.getDisplayedRowAtIndex(focused.rowIndex)
  if (!node?.data) return ''
  const colId = focused.column?.getColId?.()
  if (!colId) return ''
  return stringifyCellValue(node.data[colId])
}

function stringifyCellValue(v) {
  if (v == null) return ''
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  return String(v)
}
