import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { ThriveLogo } from '../components/Logo'
import { IllEmpty, IllHero } from '../components/Illustrations'
import { IconAlert, IconArrow, IconCheck, IconPlus, IconSave } from '../components/Icons'
import { api, ApiError } from '../lib/api'
import { ensureGuest, getGuest, guestHeaders } from '../lib/guest'
import { useStoredState, EMPTY_PROFILE } from '../lib/storage'

/**
 * "Try THRIVE" — guest access. No account, no saved teacher data.
 *
 * • Ask the assistant a bounded number of times (server-enforced quota).
 * • Save a small number of lesson-plan drafts server-side under the guest
 *   token, then adopt them when you register or sign in.
 *
 * Every limit is enforced by the backend; the counters shown here are a
 * courtesy mirror.
 */

type Msg = { id: number; role: 'teacher' | 'thrive'; text: string; sources?: any[]; mode?: string; quota?: number }
type Draft = { id: number; title: string; minutes: number; subject: string }

const SUGGESTED = [
  'I have students from Grade 2, 3 and 4 in one classroom. I have 40 minutes to teach mathematics. What should I do?',
  'Suggest a low-cost EVS activity for Grade 3 with only chalk and paper.',
  'How do I explain fractions to a mixed Grade 4 and Grade 5 group?',
]

export default function Try() {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState(getGuest())
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: 1, role: 'thrive',
      text: 'Namaste. I am THRIVE — try me without an account. Ask a teaching question in English or Hindi, and if you tell me your grades and minutes I will build a time-bound multi-grade plan.' },
  ])
  const [text, setText] = useState('')
  const [language, setLanguage] = useState('English')
  const [busy, setBusy] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [drafts, setDrafts] = useStoredState<Draft[]>('guest-drafts-local', [])
  // Any teaching context already on this device (from Guided setup or the
  // profile) rides along with guest asks — never invented, only what's saved.
  const [profile] = useStoredState<any>('profile', EMPTY_PROFILE)
  const [serverDrafts, setServerDrafts] = useState<Draft[]>([])
  const [toast, setToast] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveTitle, setSaveTitle] = useState('')
  const [saveErr, setSaveErr] = useState('')
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ;(async () => {
      const s = await ensureGuest()
      setSession(s)
      if (s) {
        try {
          const rows = await api.get<any[]>('/api/guest/plans', guestHeaders())
          setServerDrafts(rows.map(r => ({ id: r.id, title: r.title, minutes: r.minutes, subject: r.subject })))
        } catch { /* drafts unavailable — keep local mirror */ }
      }
      setReady(true)
    })()
  }, [])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs, busy])

  async function send(q = text) {
    if (!q.trim() || busy || !session) return
    const next = [...msgs, { id: Date.now(), role: 'teacher' as const, text: q.trim() }]
    setMsgs(next); setText(''); setBusy(true)
    try {
      const r = await api.post<any>('/api/guest/ask',
        { message: q.trim(), language, context: {
          state: profile.state, board: profile.board, medium: profile.medium,
          grades: profile.grades, subjects: profile.subjects,
        } }, guestHeaders())
      setRemaining(r.asks_remaining ?? null)
      setMsgs(m => [...m, { id: Date.now() + 1, role: 'thrive', text: r.reply, sources: r.sources || [], mode: r.mode, quota: r.asks_remaining }])
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 429)) {
        setMsgs(m => [...m, { id: Date.now() + 1, role: 'thrive', text: err.message,
          sources: [{ title: 'Guest limit', org: 'THRIVE', why: 'quota' }] }])
      } else {
        setMsgs(m => [...m, { id: Date.now() + 1, role: 'thrive',
          text: `I could not reach THRIVE right now (${err?.message || 'please try again in a moment'}). Try again in a moment.` }])
      }
    } finally { setBusy(false) }
  }

  function lastReplyPlan(): string | null {
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]
      if (m.role === 'thrive' && /Whole-class opening|Teacher focus|Closing check/i.test(m.text)) return m.text
    }
    return null
  }

  async function saveDraft() {
    setSaveErr('')
    const plan = lastReplyPlan()
    if (!saveTitle.trim()) return setSaveErr('Give the draft a short title first.')
    if (!plan) return setSaveErr('Ask for a lesson plan first, then save that reply as a draft.')
    try {
      const r = await api.post<any>('/api/guest/plans',
        { title: saveTitle.trim(), minutes: 40, payload: { draft: plan } }, guestHeaders())
      setServerDrafts(d => [{ id: r.id, title: saveTitle.trim(), minutes: r.minutes, subject: '' }, ...d])
      setSaveTitle(''); setSaveOpen(false)
      flash('Draft saved to this guest session')
    } catch (err: any) {
      setSaveErr(err?.message || 'Could not save the draft.')
    }
  }

  async function deleteDraft(id: number) {
    try {
      await api.delete(`/api/guest/plans/${id}`, guestHeaders())
      setServerDrafts(d => d.filter(x => x.id !== id))
      flash('Draft removed')
    } catch (err: any) {
      flash(err?.message || 'Could not remove the draft')
    }
  }

  function flash(t: string) { setToast(t); setTimeout(() => setToast(''), 2600) }

  const quotaNote = session
    ? (remaining === null
      ? `${session.ask_limit_per_hour} free questions per hour as a guest`
      : `${remaining} of ${session.ask_limit_per_hour} guest questions left this hour`)
    : 'starting your guest session…'

  return (
    <div className="try-screen">
      <Head><title>Try THRIVE — no account needed</title></Head>

      <header className="try-top">
        <Link href="/" aria-label="THRIVE home"><ThriveLogo size={34} /></Link>
        <div className="try-top-actions">
          <span className="guest-chip"><IconCheck size={12} /> Guest session · {quotaNote}</span>
          <Link href="/login" className="btn btn-small">Teacher login</Link>
          <Link href="/signup" className="btn btn-small btn-primary">Create account</Link>
        </div>
      </header>

      <div className="try-grid">
        {/* ── Conversation ────────────────────────────────────────── */}
        <section className="try-chat panel">
          <div className="chat-stage try-stage" ref={scroller}>
            {msgs.map(m => (
              <div className={'bubble ' + (m.role === 'teacher' ? 'mine' : '')} key={m.id}>
                <div style={{ whiteSpace: 'pre-line' }}>{m.text}</div>
                {m.sources && m.sources.length > 0 && (
                  <div className="sources-box">
                    {m.sources.map((s, i) => {
                      const retrieved = /matched|retrieved/i.test(s.why || '')
                      return (
                        <div className="src" key={i}>
                          {retrieved ? <IconCheck size={12} /> : <IconAlert size={12} />}
                          <span><b>[{i + 1}] {s.title || 'Source'}</b>
                            {s.org ? <span style={{ color: 'var(--faint)' }}> — {s.org}</span> : ''}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="bubble" aria-live="polite">THRIVE is thinking…</div>}
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
            {SUGGESTED.map(s => (
              <button key={s} className="btn btn-small" style={{ justifyContent: 'flex-start', textAlign: 'left', lineHeight: 1.45 }}
                onClick={() => send(s)} disabled={busy || !session}>{s}</button>
            ))}
          </div>
          <div className="chat-input" style={{ marginTop: 12, borderTop: 0, paddingTop: 0 }}>
            <select value={language} onChange={e => setLanguage(e.target.value)} aria-label="Reply language"
              style={{ borderRadius: 10, border: '1px solid var(--forest-line)', padding: '7px 9px', fontSize: 12, background: 'var(--paper)' }}>
              <option>English</option><option>Hindi</option>
            </select>
            <input className="input" value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Type your question — e.g. “Grade 2, 3 and 4, 40 minutes, mathematics”" />
            <button className="btn btn-primary" onClick={() => send()} disabled={busy || !session}>Send</button>
          </div>
        </section>

        {/* ── Side: drafts + account ──────────────────────────────── */}
        <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <section className="panel">
            <div className="panel-title">
              <div><h2>Your guest drafts</h2><p>{session?.plan_limit ?? '…'} drafts max, kept on the server for this session</p></div>
            </div>
            {(serverDrafts.length || drafts.length) ? (
              <div className="plan-list">
                {serverDrafts.map(d => (
                  <div className="plan-item" key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="plan-icon"><IconSave size={14} /></span>
                    <span style={{ flex: 1 }}><b>{d.title}</b><small>Guest draft</small></span>
                    <button className="btn btn-small btn-danger" onClick={() => deleteDraft(d.id)}>Remove</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty" style={{ padding: '18px 8px' }}>
                <IllEmpty size={92} />
                <div>Ask for a lesson plan, then save the reply as a draft.</div>
              </div>
            )}
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              <button className="btn btn-small" style={{ justifyContent: 'flex-start' }}
                onClick={() => { setSaveOpen(o => !o); setSaveErr('') }}><IconPlus size={12} /> Save latest plan as draft</button>
              {saveOpen && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <input className="input" value={saveTitle} onChange={e => setSaveTitle(e.target.value)}
                    placeholder="e.g. Grade 2–4 maths, 40 min" aria-label="Draft title" />
                  {saveErr && <div className="notice" style={{ background: '#fbefec', borderColor: '#f2d8d0', color: '#925e4d' }}>{saveErr}</div>}
                  <button className="btn btn-small btn-primary" onClick={saveDraft}>Save draft</button>
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-title">
              <div><h2>What an account adds</h2><p>Free — your drafts come with you</p></div>
            </div>
            <ul className="feature-list">
              <li><IconCheck size={13} /> Unlimited assistant questions with full sources</li>
              <li><IconCheck size={13} /> All your lesson plans, synced and exportable</li>
              <li><IconCheck size={13} /> Conversation history and personalised context</li>
              <li><IconCheck size={13} /> Training progress and community access</li>
            </ul>
            <Link href="/signup" className="btn btn-primary" style={{ marginTop: 12 }}>
              Create a free account <IconArrow size={13} />
            </Link>
            <p className="muted" style={{ fontSize: 10.5, marginTop: 9, lineHeight: 1.6 }}>
              When you register, your guest drafts are adopted into your account automatically.
              Nothing here is shared with other teachers.
            </p>
          </section>
        </aside>
      </div>

      {toast && <div className="toast" aria-live="polite">{toast}</div>}
    </div>
  )
}
