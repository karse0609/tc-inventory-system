import { useState } from 'react'
import './LoginPage.css'

export default function LoginPage({ onLogin }) {
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const ok = await onLogin(userId.trim(), password)
      if (!ok) setError('Invalid user ID or password, or account is inactive.')
    } catch {
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__card card">
        <h1 className="login-page__title-block">
          <span className="login-page__title-ko">TC TECH 실시간 해외 물류·재고 관리</span>
          <span className="login-page__title-en">
            Overseas Inventory &amp; Logistics Operations Dashboard
          </span>
        </h1>
        <p className="login-page__subtitle">Sign in to continue</p>
        <form className="login-page__form" onSubmit={handleSubmit}>
          <label className="login-page__label">
            User ID
            <input
              className="cell-input"
              autoComplete="username"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
            />
          </label>
          <label className="login-page__label">
            Password
            <input
              className="cell-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <p className="login-page__error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn--primary login-page__submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
