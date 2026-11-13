import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Catch-all proxy so the browser talks to same-origin `/api/*` while the
 * FastAPI backend lives on another origin in dev and prod.
 *
 * `req.url` includes the `/api` prefix (a request for `/api/health`
 * arrives here as `/api/health`), so strip it before forwarding — the
 * FastAPI routes live at the root (`/health`, `/compiler/run`, …).
 * Uses global fetch (Node 18+); no extra dependencies.
 */
// Use 127.0.0.1, not localhost: on Node 18+ `localhost` resolves to ::1 (IPv6)
// first, but uvicorn binds IPv4 only — so the proxy would get ECONNREFUSED.
const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8000'

export const config = { api: { bodyParser: false } }

// Hop-by-hop headers defined by HTTP that must not be forwarded to the
// upstream; everything else (Authorization, Accept, …) passes through.
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'transfer-encoding', 'te', 'trailer',
  'proxy-authenticate', 'proxy-authorization', 'upgrade',
])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const target = `${BACKEND}${(req.url || '/').replace(/^\/api/, '') || '/'}`
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks)
  // Forward the browser's headers (Authorization, Accept, Content-Type, …)
  // minus hop-by-hop ones; fetch would otherwise drop the JWT and every
  // signed-in endpoint would 401 behind the proxy.
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    const k = key.toLowerCase()
    if (HOP_BY_HOP.has(k) || k === 'host') continue
    headers[k] = Array.isArray(value) ? value.join(', ') : value
  }
  try {
    const init: RequestInit = {
      method: req.method || 'GET',
      headers,
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') init.body = raw
    const r = await fetch(target, init)
    const text = await r.text()
    res.status(r.status)
    const ct = r.headers.get('content-type')
    if (ct) res.setHeader('content-type', ct)
    res.send(text)
  } catch {
    res.status(502).json({ detail: 'THRIVE is unreachable right now — please try again in a moment.' })
  }
}
