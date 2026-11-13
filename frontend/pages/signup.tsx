import { useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import { api, setToken } from '../lib/api'
import { getGuest, clearGuest } from '../lib/guest'
import { EMPTY_PROFILE } from '../lib/storage'

/** Carry guest drafts into the fresh account (same helper as login). */
async function adoptGuestDrafts() {
  try {
    const g = getGuest()
    if (!g) return
    await api.post('/api/guest/upgrade', { guest_token: g.guest_token })
    clearGuest()
  } catch { /* keep drafts; the guest token will simply expire */ }
}

/**
 * Teacher account creation. Uses the backend /auth/signup endpoint and
 * stores the JWT so the rest of the workspace can attach it.
 */
export default function Signup() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (name.trim().length < 2) return setError('Please enter your name.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Please enter a valid email address.')
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    setBusy(true)
    try {
      const r = await api.post('/api/auth/signup', { name: name.trim(), email: email.trim(), password })
      setToken(r.token)
      // New accounts adopt any guest drafts, then keep this device's teaching
      // context (already entered locally) and attach the new identity to it.
      await adoptGuestDrafts()
      try {
        const me = await api.get<any>('/api/auth/me')
        const merged = { ...EMPTY_PROFILE, name: me.name, email: me.email, ...(me.profile || {}) }
        localStorage.setItem('thrive:profile', JSON.stringify(merged))
      } catch { /* keep whatever context is on this device */ }
      router.push('/profile')
    } catch (err: any) {
      setError(err?.message || 'Could not create the account right now — check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout title="Create account">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Create your teacher account</div>
          <h1>Start with your workspace.</h1>
          <p>An account keeps your lesson plans, progress and community activity together.</p>
        </div>
      </div>
      <section className="panel" style={{ maxWidth: 440 }}>
        <form onSubmit={submit}>
          <div className="field">
            <label>Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.in" autoComplete="email" />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
          </div>
          {error && <div className="notice" role="alert" style={{ background: '#fbefec', borderColor: '#f2d8d0', color: '#925e4d', marginBottom: 12 }}>{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        </form>
        <div className="divider" />
        <p className="muted" style={{ fontSize: 10, margin: 0 }}>
          Already have an account? <a className="text-link" href="/login">Sign in</a>, or continue without one — your work stays on this device.
        </p>
      </section>
    </Layout>
  )
}
