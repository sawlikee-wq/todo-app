import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { authApi } from './api'

const MIN_LENGTH = 4

type Status = 'loading' | 'setup' | 'login' | 'unlocked' | 'offline'

// Shows a create-password or log-in screen until the server says we're logged
// in, then renders the app with a `lock` callback that logs out.
export default function AuthGate({ children }: { children: (lock: () => void) => ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [password, setPasswordText] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const checkStatus = useCallback(() => {
    authApi
      .status()
      .then((s) => setStatus(s.loggedIn ? 'unlocked' : s.hasPassword ? 'login' : 'setup'))
      .catch(() => setStatus('offline'))
  }, [])

  useEffect(checkStatus, [checkStatus])

  // Stable identity: useTodos depends on it.
  const lock = useCallback(() => {
    authApi.logout().catch(() => {})
    setStatus('login')
  }, [])

  if (status === 'unlocked') return <>{children(lock)}</>

  if (status === 'loading') return <main className="app auth" aria-busy="true" />

  if (status === 'offline') {
    return (
      <main className="app auth">
        <h1>Todos</h1>
        <div className="auth-form">
          <p className="auth-error" role="alert">
            Can’t reach the server. Is it running? Start it with <code>npm run dev</code>.
          </p>
          <button className="add" onClick={checkStatus}>
            Try again
          </button>
        </div>
      </main>
    )
  }

  const settingUp = status === 'setup'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (settingUp) {
      if (password.length < MIN_LENGTH) return setError(`Use at least ${MIN_LENGTH} characters.`)
      if (password !== confirm) return setError('Passwords don’t match.')
    }

    setBusy(true)
    try {
      await (settingUp ? authApi.setup(password) : authApi.login(password))
      setPasswordText('')
      setConfirm('')
      setStatus('unlocked')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="app auth">
      <h1>Todos</h1>
      <form className="auth-form" onSubmit={submit}>
        <p className="auth-hint">
          {settingUp ? 'Create a password to lock your todo list.' : 'Enter your password to continue.'}
        </p>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPasswordText(e.target.value)}
            autoComplete={settingUp ? 'new-password' : 'current-password'}
            autoFocus
          />
        </label>
        {settingUp && (
          <label>
            Confirm password
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </label>
        )}
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="add" disabled={busy}>
          {busy ? 'Checking…' : settingUp ? 'Create password' : 'Log in'}
        </button>
      </form>
    </main>
  )
}
