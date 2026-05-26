import { useMemo, useState } from 'react'
import { getEnabledProducts, PILOT_MODEL_NAME } from '../../config/products'
import { operationsMeta } from '../../data/logisticsSampleData'
import { ParseProductExcelError, parseProductExcel } from '../../utils/parseGs30eExcel'
import { buildForecastApplyPreview } from '../../utils/forecastMerge'
import '../logistics/ops.css'
import './pages.css'

function formatNum(n) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(Number(n) || 0))
}

export default function ForecastUploadPage({
  masterItems,
  deliveryPlans,
  setDeliveryPlans,
  opsMeta,
}) {
  const [modelName, setModelName] = useState(PILOT_MODEL_NAME)
  const [fileName, setFileName] = useState(null)
  const [error, setError] = useState(null)
  const [parseSteps, setParseSteps] = useState([])
  const [warnings, setWarnings] = useState([])
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)

  const asOfDate = opsMeta?.asOfDate ?? operationsMeta.asOfDate
  const products = getEnabledProducts()

  const previewResult = useMemo(() => {
    if (!preview?.length) return null
    return buildForecastApplyPreview(deliveryPlans, preview, masterItems)
  }, [preview, deliveryPlans, masterItems])

  async function onFile(ev) {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return
    setLoading(true)
    setError(null)
    setPreview(null)
    setParseSteps([])
    setWarnings([])
    setFileName(file.name)
    try {
      const buffer = await file.arrayBuffer()
      const result = parseProductExcel(buffer, { modelName, asOfDate })
      setParseSteps(result.parseSteps ?? [])
      setWarnings(result.warnings ?? [])
      const rows = result.itemDeliveryPlans ?? []
      setPreview(rows)
      if (!rows.length && (result.warnings?.length || result.parseSteps?.length)) {
        setError(null)
      }
    } catch (e) {
      if (e instanceof ParseProductExcelError) {
        setError(e.message)
      } else {
        setError(e instanceof Error ? e.message : 'Parse error')
      }
      setFileName(null)
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }

  function handleApplyMatched() {
    if (!previewResult) return
    setDeliveryPlans(previewResult.next)
    setPreview(null)
    setFileName(null)
    setParseSteps([])
    setWarnings([])
  }

  return (
    <div className="page page--wide">
      <header className="page__header">
        <h1>Forecast Upload</h1>
        <p className="page__desc">
          Excel은 <strong>보조 기능</strong>입니다. Master에 등록된 Model·Part No와만 매칭하여 납품 계획
          수량을 갱신합니다. 신규 품목은 자동 추가되지 않습니다 — Master Data에서 먼저 등록하세요.
        </p>
      </header>

      <section className="card page__section">
        <div className="forecast-upload__row">
          <label>
            Target model (시트명 매칭)
            <select
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="cell-input"
            >
              {products.map((p) => (
                <option key={p.modelName} value={p.modelName}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="forecast-upload__file">
            <span className="btn btn--primary">{loading ? 'Reading…' : 'Select Excel'}</span>
            <input type="file" accept=".xlsx,.xls" hidden onChange={onFile} disabled={loading} />
          </label>
        </div>
        {fileName && <p className="page__hint">File: {fileName}</p>}
        {error && (
          <div className="page__notice page__notice--error" role="alert">
            {error}
            <p className="page__hint">
              업로드가 실패해도 Master Data가 있으면 나머지 화면은 정상 동작합니다.
            </p>
          </div>
        )}
        {parseSteps.length > 0 && (
          <ul className="forecast-upload__steps">
            {parseSteps.map((s) => (
              <li key={s.id} className={s.ok ? 'ok' : 'fail'}>
                {s.ok ? '✓' : '✗'} {s.label}
                {s.detail ? <span> — {s.detail}</span> : null}
              </li>
            ))}
          </ul>
        )}
        {warnings?.length > 0 && (
          <div className="page__notice">
            {warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        )}
      </section>

      {previewResult && (
        <section className="card page__section">
          <h2>Preview</h2>
          <p className="page__hint">
            적용 시 Master에 존재하는 Part만 반영됩니다. 신규 Part 행은 아래 &quot;Unmatched&quot;에
            표시됩니다.
          </p>
          <div className="page__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!previewResult.matched.length}
              onClick={handleApplyMatched}
            >
              Confirm — apply matched rows to Delivery Plan
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setPreview(null)
                setFileName(null)
              }}
            >
              Cancel preview
            </button>
          </div>

          <h3>Matched ({previewResult.matched.length})</h3>
          <div className="table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Part</th>
                  <th>Week start</th>
                  <th>Qty</th>
                </tr>
              </thead>
              <tbody>
                {previewResult.matched.slice(0, 50).map((r, i) => (
                  <tr key={`${r.partNo}-${r.weekStartDate || r.periodStart}-${i}`}>
                    <td>
                      <code>{r.partNo}</code>
                    </td>
                    <td>{r.weekStartDate || r.periodStart}</td>
                    <td className="cell--num">
                      {formatNum(r.qty ?? r.plannedQty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>Unmatched — add in Master Data first ({previewResult.unmatched.length})</h3>
          <div className="table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Part</th>
                  <th>Week start</th>
                  <th>Planned</th>
                </tr>
              </thead>
              <tbody>
                {previewResult.unmatched.slice(0, 50).map((r, i) => (
                  <tr key={`u-${r.partNo}-${r.weekStartDate || r.periodStart}-${i}`}>
                    <td>
                      <code>{r.partNo}</code>
                    </td>
                    <td>{r.weekStartDate || r.periodStart}</td>
                    <td className="cell--num">{formatNum(r.qty ?? r.plannedQty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
