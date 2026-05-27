import BilingualLabel from '../BilingualLabel'
import { L } from '../../i18n/labels'

/**
 * 공통 데이터 화면 툴바 — 엑셀 업/다운로드, 검색 슬롯, 저장
 * @param {{
 *   message?: string
 *   hideUpload?: boolean
 *   uploadAccept?: string
 *   onUploadChange?: (ev: import('react').ChangeEvent<HTMLInputElement>) => void
 *   hideDownload?: boolean
 *   onDownload?: () => void | Promise<void>
 *   downloadDisabled?: boolean
 *   hideSave?: boolean
 *   onSave?: () => void | Promise<void>
 *   saveDisabled?: boolean
 *   saveLabel?: { ko: string, en: string }
 *   searchSlot?: import('react').ReactNode
 *   extra?: import('react').ReactNode
 * }} props
 */
export default function PageDataToolbar({
  message = '',
  hideUpload = false,
  uploadAccept = '.xlsx,.xls',
  onUploadChange,
  hideDownload = false,
  onDownload,
  downloadDisabled = false,
  hideSave = false,
  onSave,
  saveDisabled = false,
  saveLabel = L.save,
  searchSlot = null,
  extra = null,
}) {
  const isError = message.startsWith('!')
  const text = isError ? message.slice(1) : message

  return (
    <div className="page-data-toolbar">
      <div className="page-data-toolbar__row">
        {!hideUpload && (
          <label className="btn btn--ghost btn--toolbar">
            <BilingualLabel label={L.excelUpload} as="span" />
            <input
              type="file"
              accept={uploadAccept}
              className="page-data-toolbar__file"
              onChange={onUploadChange}
            />
          </label>
        )}
        {!hideDownload && (
          <button
            type="button"
            className="btn btn--ghost btn--toolbar"
            disabled={downloadDisabled}
            onClick={() => onDownload?.()}
          >
            <BilingualLabel label={L.excelDownload} as="span" />
          </button>
        )}
        {extra}
        <span className="page-data-toolbar__spacer" aria-hidden="true" />
        {!hideSave && (
          <button
            type="button"
            className="btn btn--primary btn--toolbar"
            disabled={saveDisabled}
            onClick={() => onSave?.()}
          >
            <BilingualLabel label={saveLabel} as="span" />
          </button>
        )}
      </div>
      {searchSlot}
      {text ? (
        <p
          className={`page-data-toolbar__msg${isError ? ' page-data-toolbar__msg--error' : ''}`}
          role={isError ? 'alert' : 'status'}
        >
          {text}
        </p>
      ) : null}
    </div>
  )
}
