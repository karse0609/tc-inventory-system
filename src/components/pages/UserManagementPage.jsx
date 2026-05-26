import { useState } from 'react'
import {
  VIEW_IDS,
  VIEW_MENU_LABELS,
  defaultMenuPermissionsForRole,
} from '../../utils/permissions'
import { hashPassword } from '../../utils/auth'
import { newId } from '../../utils/newId'
import '../logistics/ops.css'
import './pages.css'

const ROLES = ['Admin', 'Manager', 'Viewer']

function countActiveAdmins(users) {
  return users.filter((u) => u.role === 'Admin' && u.active !== false).length
}

export default function UserManagementPage({ users, setUsers, currentUserId }) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function flash(msg) {
    setMessage(msg)
    setError('')
    setTimeout(() => setMessage(''), 3000)
  }

  function updateRow(id, patch) {
    setUsers((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function handleRoleChange(id, role) {
    const perms = defaultMenuPermissionsForRole(role)
    updateRow(id, { role, menuPermissions: { ...perms } })
  }

  function toggleMenu(id, key) {
    setUsers((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r
        if (r.role === 'Admin') return r
        const next = { ...(r.menuPermissions || {}), [key]: !r.menuPermissions?.[key] }
        return { ...r, menuPermissions: next }
      }),
    )
  }

  function handleAdd() {
    setUsers((rows) => [
      ...rows,
      {
        id: newId('user'),
        userId: '',
        passwordHash: '',
        name: '',
        role: 'Viewer',
        active: true,
        menuPermissions: defaultMenuPermissionsForRole('Viewer'),
      },
    ])
  }

  function handleDelete(id) {
    const row = users.find((u) => u.id === id)
    if (!row) return
    if (id === currentUserId) {
      setError('You cannot delete your own account while logged in.')
      return
    }
    if (row.role === 'Admin' && row.active !== false && countActiveAdmins(users) <= 1) {
      setError('At least one active Admin account is required.')
      return
    }
    setUsers((rows) => rows.filter((r) => r.id !== id))
    flash('User removed.')
  }

  async function handleSaveRow(row) {
    setError('')
    const uid = String(row.userId ?? '').trim()
    if (!uid) {
      setError('User ID is required.')
      return
    }
    const dup = users.some(
      (u) =>
        u.id !== row.id && String(u.userId).trim().toLowerCase() === uid.toLowerCase(),
    )
    if (dup) {
      setError(`Duplicate User ID: ${uid}`)
      return
    }

    const plain = String(row.passwordPlain ?? '').trim()
    let passwordHash = row.passwordHash
    if (plain) {
      passwordHash = await hashPassword(plain)
    }
    if (!passwordHash) {
      setError('Password is required for new users (or enter a new password).')
      return
    }

    const menuPermissions =
      row.role === 'Admin' ? defaultMenuPermissionsForRole('Admin') : { ...row.menuPermissions }

    const nextRow = {
      ...row,
      userId: uid,
      passwordHash,
      passwordPlain: undefined,
      menuPermissions,
    }

    const nextUsers = users.map((u) => (u.id === row.id ? nextRow : u))
    if (countActiveAdmins(nextUsers) < 1) {
      setError('At least one active Admin is required.')
      return
    }

    setUsers(nextUsers)
    flash('User saved.')
  }

  return (
    <section className="card page__section user-mgmt">
      <h2>User Management</h2>
      <p className="page__hint">
        Admin만 접근 가능합니다. 비밀번호는 SHA-256으로 저장됩니다(로컬 전용).
      </p>
      {message && (
        <p className="page__notice" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="page__notice page__notice--error" role="alert">
          {error}
        </p>
      )}

      <div className="page__actions" style={{ marginBottom: '0.75rem' }}>
        <button type="button" className="btn btn--ghost" onClick={handleAdd}>
          Add user
        </button>
      </div>

      <div className="table-wrap page__table">
        <table className="ops-table user-mgmt__table">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Password</th>
              <th>Name</th>
              <th>Role</th>
              <th>Active</th>
              <th>Menus</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    className="cell-input"
                    value={row.userId}
                    onChange={(e) => updateRow(row.id, { userId: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    type="password"
                    autoComplete="new-password"
                    placeholder={row.passwordHash ? 'New password (optional)' : 'Required'}
                    value={row.passwordPlain ?? ''}
                    onChange={(e) => updateRow(row.id, { passwordPlain: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    value={row.name ?? ''}
                    onChange={(e) => updateRow(row.id, { name: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    className="cell-input"
                    value={row.role}
                    onChange={(e) => handleRoleChange(row.id, e.target.value)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.active !== false}
                    onChange={(e) => updateRow(row.id, { active: e.target.checked })}
                  />
                </td>
                <td className="user-mgmt__menus">
                  <div className="user-mgmt__menu-grid">
                    {VIEW_IDS.map((mid) => (
                      <label key={mid} className="user-mgmt__menu-item">
                        <input
                          type="checkbox"
                          checked={row.role === 'Admin' ? true : !!row.menuPermissions?.[mid]}
                          disabled={row.role === 'Admin'}
                          onChange={() => toggleMenu(row.id, mid)}
                        />
                        <span>{VIEW_MENU_LABELS[mid]}</span>
                      </label>
                    ))}
                  </div>
                </td>
                <td>
                  <div className="user-mgmt__row-actions">
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => handleSaveRow(row)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => handleDelete(row.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
