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

/** Mint (or reuse) a guest session. Returns null when the backend refuses. */
export async function ensureGuest(): Promise<GuestSession | null> {
  const existing = getGuest()
  if (existing) return existing
  try {
    const s = await api.post<GuestSession>('/api/guest/session')
    setGuest(s)
    return s
  } catch { return null }
}

/** Headers for guest-scoped requests. */
export function guestHeaders(): Record<string, string> {
  const s = getGuest()
  return s ? { 'x-guest-token': s.guest_token } : {}
}

export function clearGuest() { setGuest(null) }
