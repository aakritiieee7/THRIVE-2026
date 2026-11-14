import { useEffect, useState } from 'react'
import Head from 'next/head'
import Layout from '../components/Layout'
import { api } from '../lib/api'
import { IconCheck, IconAlert } from '../components/Icons'

/**
 * /demo — the projection screen for a live presentation.
 *
 * Shows how to reach the bot (QR + wa.me link), whether the Cloud API is
 * actually live, and the last few real exchanges. Everything here is read
 * from the backend: nothing is simulated, so if the bot is not connected the
 * page says so instead of showing a pretty fake conversation.
 */

type Turn = {
  phone: string
  inbound: string
  reply: string
  action: string
  language: string
  at: string
}

type Status = {
  configured?: boolean
  live?: boolean
  signing?: boolean
  mode?: string
  note?: string
  wa_number?: string
  linked_senders?: number
}

export default function Demo() {
  const [status, setStatus] = useState<Status | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [error, setError] = useState('')
  const [waNumber, setWaNumber] = useState('')

  async function load() {
    try {
      const s = await api.get<Status>('/api/assistant/whatsapp/status')
      setStatus(s)
      if (s?.wa_number) setWaNumber(s.wa_number)
      setError('')
    } catch (e: any) {
      setStatus(null)
      setError(e?.message || 'Could not reach the backend.')
    }
    try {
      const rows = await api.get<Turn[]>('/api/assistant/whatsapp/log?limit=10')
      setTurns(Array.isArray(rows) ? rows : [])
    } catch { setTurns([]) }
  }

  useEffect(() => { load() }, [])

  // Poll while the page is open so a message sent during the demo appears.
  useEffect(() => {
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [])

  const waDigits = waNumber.replace(/\D/g, '')
  const waLink = waDigits ? `https://wa.me/${waDigits}` : ''

  return (
    <Layout title="WhatsApp demo">
      <Head><title>WhatsApp demo — THRIVE</title></Head>

      <div className="page-heading">
        <div>
          <div className="eyebrow">Live demonstration</div>
          <h1>Message THRIVE on WhatsApp.</h1>
          <p>Scan the code, send a question, and watch the reply appear below.</p>
        </div>
        <span className="tag">Simulation off · real Cloud API</span>
      </div>

      {error && (
        <div className="notice" role="alert" style={{ marginBottom: 14 }}>
          <IconAlert size={13} /> {error} — if you are on the deployed site, set
          <code style={{ margin: '0 4px' }}>BACKEND_URL</code> in Vercel.
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
        <section className="panel">
          <div className="panel-title"><div><h2>Connect</h2><p>The bot’s WhatsApp number</p></div></div>

          <div style={{ background: '#fff', borderRadius: 10, padding: 12, display: 'grid', placeItems: 'center', border: '1px solid var(--line)' }}>
            {/* Rendered server-side, so no QR library ships to the browser. */}
            <img src="/api/assistant/whatsapp/qr" alt="QR code to open a WhatsApp chat with THRIVE"
              width={220} height={220} style={{ imageRendering: 'pixelated' }} />
          </div>

          {waLink
            ? <a className="btn btn-small btn-primary" href={waLink} target="_blank" rel="noreferrer"
                style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}>Open WhatsApp ↗</a>
            : <p className="muted" style={{ fontSize: 10.5, marginTop: 12 }}>
                Number not configured — set WHATSAPP_DISPLAY_NUMBER on the backend.
              </p>}

          <div className="divider" />

          <div className="plan-list">
            <div className="plan-item">
              <span className="plan-icon">{status?.live ? <IconCheck size={13} /> : <IconAlert size={13} />}</span>
              <span>
                <b>{status?.live ? 'Live sends enabled' : 'Not connected'}</b>
                <small>{status?.note || 'Checking…'}</small>
              </span>
            </div>
            <div className="plan-item">
              <span className="plan-icon">{status?.signing ? <IconCheck size={13} /> : <IconAlert size={13} />}</span>
              <span>
                <b>{status?.signing ? 'Signatures verified' : 'Signatures off'}</b>
                <small>{status?.signing ? 'Unsigned webhook calls are refused.' : 'Set WHATSAPP_APP_SECRET before going live.'}</small>
              </span>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            <div><h2>Conversation log</h2><p>The last {turns.length || 'few'} exchanges — live, not simulated</p></div>
            <button className="btn btn-small" onClick={load}>Refresh</button>
          </div>

          {turns.length === 0
            ? <div className="empty">
                No WhatsApp messages yet. Send “help” to the number to start.
              </div>
            : <div style={{ display: 'grid', gap: 10 }}>
                {turns.map((t, i) => (
                  <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--faint)', marginBottom: 6 }}>
                      <span>{t.phone}{t.action ? ` · ${t.action}` : ''} · {t.language}</span>
                      <span>{t.at?.replace('T', ' ').replace('Z', '')}</span>
                    </div>
                    <div style={{ fontSize: 11.5, marginBottom: 6 }}><b>Teacher:</b> {t.inbound}</div>
                    <div style={{ fontSize: 11.5, whiteSpace: 'pre-line', color: 'var(--ink-soft)' }}>
                      <b>THRIVE:</b> {t.reply.length > 420 ? `${t.reply.slice(0, 420)}…` : t.reply}
                    </div>
                  </div>
                ))}
              </div>}
        </section>
      </div>

      <p className="muted" style={{ fontSize: 10, marginTop: 14 }}>
        Phone numbers are shown masked (last four digits only). No student names are stored.
      </p>
    </Layout>
  )
}
