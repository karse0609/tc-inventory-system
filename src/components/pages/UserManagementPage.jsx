import { useMemo, useState } from 'react'
import BilingualLabel from '../BilingualLabel'
import PageDataToolbar from '../grid/PageDataToolbar.jsx'
import {
  VIEW_IDS,
  VIEW_MENU_LABELS,
  defaultMenuPermissionsForRole,
  defaultMenuPermissionsForPartnerTest,
  PARTNER_TEST_ROLE,
} from '../../utils/permissions'
import { hashPassword } from '../../utils/auth'
import { newId } from '../../utils/newId'
import { downloadXlsxFromAoA } from '../../utils/excelFile'
import { useMobileSimpleLayout } from '../../utils/mobileLayout'
import { L, formatKoEn, formatKoEnInline } from '../../i18n/labels'
import '../logistics/ops.css'
import './pages.css'

const ROLES = ['Admin', 'Manager', PARTNER_TEST_ROLE, 'Viewer']

function countActiveAdmins(users) {
  return users.filter((u) => u.role === 'Admin' && u.active !== false).length
}

function lc(s) {
  return String(s ?? '').toLowerCase()
}

export default function UserManagementPage({ users, setUsers, currentUserId }) {
  const isMobile = useMobileSimpleLayout()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [searchText, setSearchText] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [excelMsg, setExcelMsg] = useState('')

  const displayedUsers = useMemo(() => {
    const q = appliedSearch.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        lc(u.userId).includes(q) ||
        lc(u.name).includes(q) ||
        lc(u.role).includes(q),
    )
  }, [users, appliedSearch])

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
      row.role === 'Admin'
        ? defaultMenuPermissionsForRole('Admin')
        : row.role === PARTNER_TEST_ROLE
          ? defaultMenuPermissionsForPartnerTest()
          : { ...row.menuPermissions }

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

  function handleDownloadUsers() {
    setExcelMsg('')
    const header = ['User ID', 'Name', 'Role', 'Active']
    const body = displayedUsers.map((u) => [
      u.userId ?? '',
      u.name ?? '',
      u.role ?? '',
      u.active !== false ? 'TRUE' : 'FALSE',
    ])
    downloadXlsxFromAoA('UserManagement', 'Users', [header, ...body])
    setExcelMsg(formatKoEn(L.excelExportDone))
    setTimeout(() => setExcelMsg(''), 2500)
  }

  return (
    <section className="card page__section user-mgmt">
      <h2>
        <BilingualLabel label={L.userManagementTitle} as="span" />
      </h2>
      <p className="page__hint">
        <BilingualLabel label={L.userManagementHint} as="span" />
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

      <PageDataToolbar
        hideUpload
        hideSave
        hideDownload={isMobile}
        onDownload={handleDownloadUsers}
        downloadDisabled={displayedUsers.length === 0}
        message={excelMsg}
        extra={
          <button type="button" className="btn btn--ghost btn--toolbar" onClick={handleAdd}>
            <BilingualLabel label={L.userManagementAdd} as="span" />
          </button>
        }
        searchSlot={
          <form
            className="page-search-strip"
            onSubmit={(e) => {
              e.preventDefault()
              setAppliedSearch(searchText.trim().toLowerCase())
            }}
          >
            <div className="page-search-strip__fields">
              <label className="page-search-strip__field">
                <span className="page-search-strip__label">
                  <BilingualLabel label={L.pageSearchUser} as="span" />
                </span>
                <input
                  className="cell-input"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  aria-label={formatKoEnInline(L.pageSearchUser)}
                />
              </label>
            </div>
            <div className="page-search-strip__actions">
              <button type="submit" className="btn btn--primary btn--toolbar">
                <BilingualLabel label={L.pageSearchButton} as="span" />
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--toolbar"
                onClick={() => {
                  setSearchText('')
                  setAppliedSearch('')
                }}
              >
                <BilingualLabel label={L.pageSearchReset} as="span" />
              </button>
            </div>
          </form>
        }
      />

      <div className="table-wrap page__table">
        <table className="ops-table user-mgmt__table">
          <thead>
            <tr>
              <th>
                <BilingualLabel label={L.userIdCol} as="span" />
              </th>
              <th>
                <BilingualLabel label={L.passwordCol} as="span" />
              </th>
              <th>
                <BilingualLabel label={L.nameCol} as="span" />
              </th>
              <th>
                <BilingualLabel label={L.roleCol} as="span" />
              </th>
              <th>
                <BilingualLabel label={L.activeCol} as="span" />
              </th>
              <th>
                <BilingualLabel label={L.menusCol} as="span" />
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {displayedUsers.map((row) => (
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
                        {r === PARTNER_TEST_ROLE ? formatKoEn(L.rolePartnerTest) : r}
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
                        <span>
                          <BilingualLabel label={VIEW_MENU_LABELS[mid]} as="span" />
                        </span>
                      </label>
                    ))}
                  </div>
                </td>
                <td>
                  <div className="user-mgmt__row-actions">
                    <button
                      type="button"
                      className="btn btn--primary btn--toolbar"
                      onClick={() => handleSaveRow(row)}
                    >
                      <BilingualLabel label={L.save} as="span" />
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--toolbar"
                      onClick={() => handleDelete(row.id)}
                    >
                      <BilingualLabel label={L.transitRowDelete} as="span" />
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
