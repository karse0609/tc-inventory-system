import { useEffect } from 'react'
import { splitTsvToMatrix } from '../utils/excelGridClipboard'

/** Excel/TSV: plain text from ClipboardEvent (배포 환경에서 type 차이 대비) */
export function getClipboardPlainText(clipboardData) {
  if (!clipboardData) return ''
  const plain = clipboardData.getData('text/plain')
  if (plain != null && plain !== '') return plain
  const text = clipboardData.getData('text')
  if (text != null && text !== '') return text
  return ''
}

/**
 * 문서 캡처 단계 paste — 포커스가 tableRef 안의 [data-excel-paste]일 때만 처리.
 * clipboardData.getData('text/plain') / getData('text') → 탭·줄바꿈 분리(splitTsvToMatrix).
 *
 * @param {{ tableRef: React.RefObject<HTMLElement | null>, enabled?: boolean, onPasteMatrix?: (matrix: string[][], anchorEl: HTMLElement) => void, rowCopyShortcut?: boolean }} opts
 */
export default function useGridNativePaste({
  tableRef,
  enabled = true,
  onPasteMatrix,
  rowCopyShortcut = true,
}) {
  useEffect(() => {
    if (!enabled || typeof onPasteMatrix !== 'function') return undefined

    const pasteHandler = (e) => {
      const root = tableRef.current
      if (!root) return
      const t = e.target
      if (!(t instanceof Node) || !root.contains(t)) return
      const cell = t instanceof Element ? t.closest('[data-excel-paste]') : null
      if (!cell || !root.contains(cell)) return

      const text = getClipboardPlainText(e.clipboardData)
      if (text === '') return

      const matrix = splitTsvToMatrix(text)
      if (!matrix.length) return

      e.preventDefault()
      e.stopPropagation()
      onPasteMatrix(matrix, cell)
    }

    document.addEventListener('paste', pasteHandler, true)
    return () => document.removeEventListener('paste', pasteHandler, true)
  }, [enabled, tableRef, onPasteMatrix])

  /** Ctrl+Shift+C: 현재 행의 [data-excel-paste] 값을 TSV로 복사 → Excel 행 붙여넣기 */
  useEffect(() => {
    if (!enabled || !rowCopyShortcut) return undefined

    const keyHandler = (e) => {
      if (!e.ctrlKey || !e.shiftKey) return
      if (String(e.key || '').toLowerCase() !== 'c') return
      const root = tableRef.current
      if (!root) return
      const ae = document.activeElement
      if (!(ae instanceof Element) || !root.contains(ae)) return
      const tr = ae.closest('tr')
      if (!tr || !root.contains(tr)) return
      const cells = [...tr.querySelectorAll('[data-excel-paste]')]
      if (!cells.length) return
      const line = cells
        .map((n) => {
          if (n instanceof HTMLInputElement || n instanceof HTMLTextAreaElement) return n.value
          if (n instanceof HTMLSelectElement) return n.value
          return (n.textContent ?? '').trim()
        })
        .join('\t')
      if (!line) return
      e.preventDefault()
      e.stopPropagation()
      void (async () => {
        try {
          if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(line)
        } catch {
          /* 권한/보안 컨텍스트 */
        }
      })()
    }

    document.addEventListener('keydown', keyHandler, true)
    return () => document.removeEventListener('keydown', keyHandler, true)
  }, [enabled, tableRef, rowCopyShortcut])

  return undefined
}
