import { formatKoEn, L } from '../../i18n/labels'

/**
 * @param {{
 *   onPasteFromExcel: () => void | Promise<void>
 *   onCopyToExcel: () => void | Promise<void>
 *   onClearSelected: () => void
 *   selectedCount?: number
 *   disabled?: boolean
 *   message?: string
 * }} props
 */
export default function ExcelGridToolbar({
  onPasteFromExcel,
  onCopyToExcel,
  onClearSelected,
  selectedCount = 0,
  disabled = false,
  message = '',
}) {
  const isError = message.startsWith('!')
  const text = isError ? message.slice(1) : message

  return (
    <div className="excel-grid-toolbar">
      <div className="excel-grid-toolbar__buttons">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={disabled}
          onClick={() => onPasteFromExcel()}
        >
          {formatKoEn(L.excelPasteFrom)}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={disabled}
          onClick={() => onCopyToExcel()}
        >
          {formatKoEn(L.excelCopyTo)}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={disabled || selectedCount === 0}
          onClick={() => onClearSelected()}
        >
          {formatKoEn(L.excelClearSelected)}
        </button>
        {selectedCount > 0 && (
          <span className="excel-grid-toolbar__count">
            {selectedCount} {formatKoEn(L.excelRowsSelected)}
          </span>
        )}
      </div>
      {text ? (
        <p
          className={`excel-grid-toolbar__msg${isError ? ' excel-grid-toolbar__msg--error' : ''}`}
          role={isError ? 'alert' : 'status'}
        >
          {text}
        </p>
      ) : null}
    </div>
  )
}
