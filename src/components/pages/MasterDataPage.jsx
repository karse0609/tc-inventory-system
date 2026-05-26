import { useState } from 'react'
import { getEnabledProducts } from '../../config/products'
import { MIN_MANAGEMENT_WEEKS } from '../../config/inventoryPolicy'
import { saveJson, storageKeys } from '../../utils/appPersistence'
import { newId } from '../../utils/newId'
import '../logistics/ops.css'
import './pages.css'

export default function MasterDataPage({ masterItems, setMasterItems }) {
  const products = getEnabledProducts()
  const [saveHint, setSaveHint] = useState('')

  function flashSaved() {
    setSaveHint('Saved to browser storage')
    setTimeout(() => setSaveHint(''), 2500)
  }

  function handleSave() {
    saveJson(storageKeys.master, masterItems)
    flashSaved()
  }

  function updateRow(id, patch) {
    setMasterItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function handleAdd() {
    setMasterItems((rows) => [
      ...rows,
      {
        id: newId('master'),
        modelName: '',
        partNo: '',
        description: '',
        currentStock: 0,
        unitPrice: 0,
        weeklyDemand: 0,
        safetyStockWeeks: MIN_MANAGEMENT_WEEKS,
        leadTime: 14,
        status: 'Active',
      },
    ])
  }

  function handleDelete(id) {
    setMasterItems((rows) => rows.filter((r) => r.id !== id))
  }

  return (
    <div className="page page--wide">
      <header className="page__header">
        <h1>Master Data</h1>
        <p className="page__desc">
          품목 기초 데이터를 화면에서 직접 등록합니다. 셀을 수정하면 대시보드에 바로 반영되며, Save로
          브라우저 저장을 확정할 수 있습니다.
        </p>
        <div className="page__actions">
          <button type="button" className="btn btn--ghost" onClick={handleAdd}>
            Add Item
          </button>
          <button type="button" className="btn btn--primary" onClick={handleSave}>
            Save
          </button>
        </div>
        {saveHint && (
          <p className="page__hint" role="status">
            {saveHint}
          </p>
        )}
      </header>

      <div className="table-wrap page__table">
        <table className="ops-table master-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Part No</th>
              <th>Description</th>
              <th>Current Stock</th>
              <th>Unit Price</th>
              <th>Weekly Demand</th>
              <th>Safety (wks)</th>
              <th>Lead Time (d)</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {masterItems.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    className="cell-input"
                    list="model-options"
                    value={row.modelName}
                    onChange={(e) => updateRow(row.id, { modelName: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    value={row.partNo}
                    onChange={(e) => updateRow(row.id, { partNo: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input master-table__desc"
                    value={row.description}
                    onChange={(e) => updateRow(row.id, { description: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input cell-input--num"
                    type="number"
                    value={row.currentStock}
                    onChange={(e) =>
                      updateRow(row.id, { currentStock: Number(e.target.value) || 0 })
                    }
                  />
                </td>
                <td>
                  <input
                    className="cell-input cell-input--num"
                    type="number"
                    step="0.01"
                    value={row.unitPrice}
                    onChange={(e) =>
                      updateRow(row.id, { unitPrice: Number(e.target.value) || 0 })
                    }
                  />
                </td>
                <td>
                  <input
                    className="cell-input cell-input--num"
                    type="number"
                    value={row.weeklyDemand}
                    onChange={(e) =>
                      updateRow(row.id, { weeklyDemand: Number(e.target.value) || 0 })
                    }
                  />
                </td>
                <td>
                  <input
                    className="cell-input cell-input--num"
                    type="number"
                    min={0}
                    value={row.safetyStockWeeks ?? MIN_MANAGEMENT_WEEKS}
                    onChange={(e) =>
                      updateRow(row.id, {
                        safetyStockWeeks: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    className="cell-input cell-input--num"
                    type="number"
                    min={0}
                    value={row.leadTime ?? 0}
                    onChange={(e) =>
                      updateRow(row.id, { leadTime: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                </td>
                <td>
                  <select
                    className="cell-input"
                    value={row.status}
                    onChange={(e) => updateRow(row.id, { status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => handleDelete(row.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <datalist id="model-options">
        {products.map((p) => (
          <option key={p.modelName} value={p.modelName} />
        ))}
      </datalist>
    </div>
  )
}
