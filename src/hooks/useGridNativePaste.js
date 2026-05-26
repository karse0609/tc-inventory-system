import { useEffect } from 'react'
import { splitTsvToMatrix } from '../utils/excelGridClipboard'

/**
 * 문서 캡처 단계에서 Ctrl+V 처리 — 포커스가 tableRef 안의 [data-excel-paste] 셀에 있을 때만.
 * @param {{ tableRef: React.RefObject<HTMLElement | null>, enabled?: boolean, onPasteMatrix: (matrix: string[][], anchorEl: HTMLElement) => void }} opts
 */
export default function useGridNativePaste({ tableRef, enabled = true, onPasteMatrix }) {
  useEffect(() => {
    if (!enabled || typeof onPasteMatrix !== 'function') return undefined

    const handler = (e) => {
      const root = tableRef.current
      if (!root) return
      const ae = document.activeElement
      if (!ae || !root.contains(ae)) return
      const cell = ae.closest('[data-excel-paste]')
      if (!cell || !root.contains(cell)) return

      const text = e.clipboardData?.getData('text/plain')
      if (text == null) return
      const trimmed = String(text).trim()
      if (!trimmed) return

      const matrix = splitTsvToMatrix(text)
      if (!matrix.length) return

      e.preventDefault()
      e.stopPropagation()
      onPasteMatrix(matrix, cell)
    }

    document.addEventListener('paste', handler, true)
    return () => document.removeEventListener('paste', handler, true)
  }, [enabled, tableRef, onPasteMatrix])
}
