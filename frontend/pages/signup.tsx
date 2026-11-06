import { useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import { api, setToken } from '../lib/api'

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
      router.push('/profile')
    } catch (err: any) {
      setError(err?.message || 'Could not create the account. Is the backend running?')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout title="Create account">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CREATE YOUR TEACHER ACCOUNT</div>
          <h1>Start with your workspace.</h1>
          <p>An account keeps your lesson plans, progress and community activity together.</p>
        </div>
      </div>
      <section className="panel" style={{ maxWidth: 440 }}>
        <form onSubmit={submit}>
          <div className="field">
            <label>Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aarohi Sharma" autoComplete="name" />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.in" autoComplete="email" />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
          </div>
          {error && <div className="notice" style={{ background: '#fbefec', borderColor: '#f2d8d0', color: '#925e4d', marginBottom: 12 }}>{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account →'}</button>
        </form>
        <div className="divider" />
        <p className="muted" style={{ fontSize: 10, margin: 0 }}>
          Already have an account? Use <a className="text-link" href="/profile">My profile</a> to sign in, or continue without one — your work stays on this device.
        </p>
      </section>
    </Layout>
  )
}
