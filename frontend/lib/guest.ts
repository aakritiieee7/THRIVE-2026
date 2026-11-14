/**
 * Guest (anonymous) session helpers.
 *
 * A guest session is a short-lived token minted by the backend
 * (POST /api/guest/session). It carries no identity, grants no access to
 * any teacher's data, and lets a signed-out visitor:
 *   • ask the assistant a bounded number of times per hour,
 *   • keep a small number of lesson-plan drafts server-side,
 * then adopt those drafts when they register.
 *
 * The token lives in localStorage (also echoed as an httponly cookie by the
 * backend). All limits are enforced server-side — this file only mirrors
 * them for the UI.
 */
import { api } from './api'

const KEY = 'thrive:guest'

export type GuestSession = {
  guest_token: string
  expires_hours: number
  ask_limit_per_hour: number
  plan_limit: number
}

export function getGuest(): GuestSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as GuestSession) : null
  } catch { return null }
}

export function setGuest(s: GuestSession | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch { /* storage unavailable */ }
}

/**
 * Why the last ensureGuest() call failed, for the UI to show a real message
 * instead of a generic one. Cleared on the next successful mint.
 */
export let lastGuestError: { status: number; message: string } | null = null

/**
 * Mint (or reuse) a guest session. Returns null when the backend refuses.
 *
 * Failures are logged rather than swallowed: this used to `catch { return
 * null }`, so a 502 from a misconfigured BACKEND_URL, a 429 on the mint cap,
 * and a cold-start timeout all looked identical to the caller — and the app
 * could only say "Could not start a guest session". A distinct status here
 * lets the UI name the actual cause.
 */
export async function ensureGuest(): Promise<GuestSession | null> {
  const existing = getGuest()
  if (existing) return existing
  try {
    const s = await api.post<GuestSession>('/api/guest/session')
    setGuest(s)
    lastGuestError = null
    return s
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 0
    const message = String(err?.message || 'network error')
    lastGuestError = { status, message }
    // Always visible in the browser console; in dev also in the Next terminal.
    console.error('[THRIVE] guest session failed', { status, message })
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        status === 502
          ? '[THRIVE] 502 from /api/guest/session — the Next proxy could not reach the backend. Set BACKEND_URL to the public FastAPI origin.'
          : '[THRIVE] guest session refused — see status above.'
      )
    }
    return null
  }
}

/**
 * A short, human explanation of why the guest session could not start.
 * Used by the assistant so the teacher sees the cause, not just "try again".
 */
export function guestErrorMessage(): string {
  const e = lastGuestError
  if (!e) return 'Could not start a guest session right now.'
  if (e.status === 502 || e.status === 504 || e.status === 0)
    return 'THRIVE’s assistant server is unreachable. If you run this locally, start the backend and set BACKEND_URL; otherwise try again in a moment.'
  if (e.status === 429)
    return 'Too many guest sessions from this network right now. Please try again in a few minutes, or create a free account.'
  if (e.status >= 500)
    return 'THRIVE’s assistant is briefly unavailable. Please try again in a moment.'
  return e.message
}

/** Headers for guest-scoped requests. */
export function guestHeaders(): Record<string, string> {
  const s = getGuest()
  return s ? { 'x-guest-token': s.guest_token } : {}
}

export function clearGuest() { setGuest(null) }
