/**
 * Minimal typed API client for the THRIVE backend.
 * - Same-origin `/api/*` (Next.js proxies to FastAPI).
 * - JWT stored in localStorage when a teacher signs in.
 * - Every call degrades gracefully: when the backend is unreachable the
 *   caller can fall back to local-only behaviour instead of breaking.
 */

const TOKEN_KEY = 'thrive:token'

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* storage unavailable */ }
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as any) }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch(path, { ...init, headers })
  } catch {
    throw new ApiError(0, 'Backend unavailable — working locally on this device.')
  }
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) {
    const detail = data && typeof data === 'object' ? data.detail : undefined
    let message = `Request failed (${res.status})`
    if (typeof detail === 'string') message = detail
    else if (Array.isArray(detail)) message = detail.join(' ')
    else if (detail && typeof detail === 'object') message = Object.values(detail as any)[0] as string
    throw new ApiError(res.status, message)
  }
  return data as T
}

export const api = {
  get: <T = any>(path: string, headers?: Record<string, string>) => request<T>(path, { headers }),
  post: <T = any>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body), headers }),
  put: <T = any>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body), headers }),
  delete: <T = any>(path: string, headers?: Record<string, string>) =>
    request<T>(path, { method: 'DELETE', headers }),
}

/** Returns true when the backend answers its health check. */
export async function backendUp(): Promise<boolean> {
  try { await api.get('/api/health'); return true } catch { return false }
}
