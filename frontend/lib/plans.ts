import { api, getToken } from './api'
import { guestHeaders, ensureGuest } from './guest'

/**
 * One shape for saved lesson plans everywhere in the app.
 *
 * The server rows are {id, title, subject, medium, board, minutes, payload,
 * created_at}; older local writes stored the display fields flat. Readers
 * (Home, My resources, the assistant, Curriculum Studio) only ever see the
 * flat display item — normalizePlan() derives the fields either way, so a
 * plan saved on any surface opens identically on every other surface.
 */

export type PlanItem = {
  id: number | string
  title: string
  subject: string
  medium: string
  board: string
  minutes: number
  grades: any[]
  schedule: any[]
  assessments?: any[]
  sources?: any[]
  materials?: string
  buffer?: number
  savedAt?: string
  server?: boolean
  draft?: string
}

export function normalizePlan(raw: any): PlanItem | null {
  if (!raw || typeof raw !== 'object') return null
  const payload = (raw.payload && typeof raw.payload === 'object') ? raw.payload : null
  const grades = payload?.grades ?? raw.grades ?? []
  const schedule = payload?.schedule ?? raw.schedule ?? []
  // A raw server row carries its fields at the top level; a local mirror
  // already stores them there. Only fall back to the payload when missing.
  const item: PlanItem = {
    id: raw.id ?? Date.now(),
    title: raw.title || payload?.title || 'Lesson plan',
    subject: raw.subject || payload?.subject || '',
    medium: raw.medium ?? payload?.medium ?? '',
    board: raw.board ?? payload?.board ?? '',
    minutes: Number(raw.minutes ?? payload?.minutes ?? 40),
    grades,
    schedule,
    assessments: payload?.assessments ?? raw.assessments ?? [],
    sources: payload?.sources ?? raw.sources ?? [],
    materials: payload?.materials ?? raw.materials ?? '',
    buffer: Number(payload?.buffer ?? raw.buffer ?? 0),
    savedAt: raw.created_at || raw.savedAt || undefined,
    draft: payload?.draft ?? raw.draft,
    server: raw.server ?? (typeof raw.id === 'number' && raw.id < 1000000000000),
  }
  if (!item.title && !item.grades.length && !item.schedule.length && !item.draft) return null
  return item
}

export function normalizePlans(rows: any[]): PlanItem[] {
  return (rows || []).map(normalizePlan).filter(Boolean) as PlanItem[]
}

/** Merge server rows over a local mirror, newest first, no duplicates. */
export function mergePlans(local: PlanItem[], server: any[]): PlanItem[] {
  const mapped = normalizePlans(server)
  if (!mapped.length) return local
  const ids = new Set(mapped.map(m => String(m.id)))
  return [...mapped, ...local.filter(p => !ids.has(String(p.id)))]
}

/** Load every plan this visitor can see: account, guest session, or device. */
export async function fetchPlans(): Promise<PlanItem[]> {
  try {
    if (getToken()) return normalizePlans(await api.get<any[]>('/api/plans'))
    const guest = await ensureGuest()
    if (guest) return normalizePlans(await api.get<any[]>('/api/guest/plans', guestHeaders()))
  } catch { /* offline or backend down — caller falls back to the local mirror */ }
  return []
}

/** Persist one plan and return the stored flat item (server row when possible). */
export async function savePlan(item: Omit<PlanItem, 'id' | 'server'>): Promise<PlanItem> {
  const payload: any = {
    title: item.title, grades: item.grades, minutes: item.minutes, subject: item.subject,
    medium: item.medium, board: item.board, materials: item.materials, buffer: item.buffer,
    schedule: item.schedule, assessments: item.assessments || [], sources: item.sources || [],
    savedAt: item.savedAt || new Date().toISOString(),
    ...(item.draft ? { draft: item.draft } : {}),
  }
  try {
    if (getToken()) {
      const r = await api.post<any>('/api/plans', {
        title: item.title, subject: item.subject, medium: item.medium,
        board: item.board, minutes: item.minutes, payload,
      })
      return { ...item, id: r.id, savedAt: payload.savedAt, server: true }
    }
    const guest = await ensureGuest()
    if (guest) {
      const r = await api.post<any>('/api/guest/plans',
        { title: item.title, minutes: item.minutes, payload }, guestHeaders())
      return { ...item, id: r.id, savedAt: payload.savedAt, server: true }
    }
  } catch { /* fall through to a device-only copy */ }
  return { ...item, id: Date.now(), savedAt: payload.savedAt, server: false }
}
