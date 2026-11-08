import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ThriveLogo } from '../components/Logo'
import { api, setToken } from '../lib/api'
import { getGuest, clearGuest } from '../lib/guest'
import { IllHero } from '../components/Illustrations'

/**
 * Dedicated teacher sign-in page — separate from the public landing page.
 * Uses the backend /auth/login endpoint and stores the JWT.
 */
export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Please enter a valid email address.')
    if (!password) return setError('Please enter your password.')
    setBusy(true)
    try {
      const r = await api.post('/api/auth/login', { email: email.trim(), password })
      setToken(r.token)
      // Carry over any guest drafts into this account before leaving.
      await adoptGuestDrafts()
      router.push('/')
    } catch (err: any) {
      setError(err?.status === 401
        ? 'That email and password do not match an account.'
        : (err?.message || 'Could not sign in. Is the backend running?'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <Head>
        <title>Teacher login — THRIVE</title>
      </Head>
      <div className="auth-shell">
        <aside className="auth-art" aria-hidden="true">
          <ThriveLogo size={40} />
          <div style={{ flex: 1 }} />
          <IllHero size={300} />
          <p className="muted" style={{ fontSize: 11, lineHeight: 1.6 }}>
            Teacher Support, Together.
          </p>
        </aside>
        <main className="auth-form-col">
          <div className="auth-brand">
            <ThriveLogo size={30} />
          </div>
          <div className="page-heading">
            <div>
              <div className="eyebrow">Teacher login</div>
              <h1>Welcome back.</h1>
              <p>Sign in to your saved lesson plans, progress and conversation history.</p>
            </div>
          </div>
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.in" autoComplete="email" required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password" autoComplete="current-password" required />
            </div>
            {error && <div className="notice" style={{ background: '#fbefec', borderColor: '#f2d8d0', color: '#925e4d', marginBottom: 12 }}>{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <div className="divider" />
          <button className="btn" type="button" disabled={busy} style={{ width: '100%' }}
            onClick={() => { setEmail('demo@thrive.in'); setPassword('thrive-demo-2026'); setError('') }}>
            Use the demo teacher account
          </button>
          <p className="muted" style={{ fontSize: 10.5, marginTop: 8, lineHeight: 1.6 }}>
            Fills the demo credentials above — a seeded account with sample plans, progress and
            community posts for walkthroughs. Seeded by <code>scripts/seed_demo.py</code>.
          </p>
          <p className="muted" style={{ fontSize: 11, marginTop: 14, lineHeight: 1.6 }}>
            New to THRIVE? <Link href="/signup" className="text-link">Create a teacher account</Link>.<br />
            Or <Link href="/try" className="text-link">try THRIVE as a guest</Link> — no account needed.
          </p>
        </main>
      </div>
    </div>
  )
}

async function adoptGuestDrafts() {
  try {
    const g = getGuest()
    if (!g) return
    await api.post('/api/guest/upgrade', { guest_token: g.guest_token })
    clearGuest()
  } catch { /* keep drafts; the guest token will simply expire */ }
}
