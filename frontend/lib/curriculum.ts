import { api } from './api'

/**
 * Curriculum helpers shared by the Curriculum Studio and the Assistant.
 * All calls degrade to `null` when the backend is offline so the UI can
 * fall back to teacher-provided goals without breaking.
 */

export type Outcome = { id: string; text: string; kl_level?: string }
export type Chapter = {
  id: string
  title: string
  learning_outcomes: Outcome[]
  prerequisites?: string[]
  resources?: { type?: string; link?: string }[]
}
export type SubjectChapters = { name: string; chapters: Chapter[] }

export async function fetchChapters(grade: string, subject?: string): Promise<SubjectChapters[] | null> {
  try {
    const q = new URLSearchParams({ grade })
    if (subject) q.set('subject', subject)
    const r = await api.get(`/api/curriculum/chapters?${q.toString()}`)
    return (r?.subjects ?? null) as SubjectChapters[] | null
  } catch {
    return null
  }
}

/** Pick the chapter whose title best matches the teacher-typed topic. */
export function matchChapter(topic: string, subjects: SubjectChapters[] | null): { chapter?: Chapter; subject?: string } {
  if (!subjects || !topic.trim()) return {}
  const needle = topic.trim().toLowerCase()
  for (const s of subjects) {
    for (const c of s.chapters) {
      const t = c.title.toLowerCase()
      if (needle.includes(t) || t.includes(needle)) return { chapter: c, subject: s.name }
    }
  }
  // token overlap fallback
  const tokens = needle.split(/\s+/).filter((w) => w.length > 3)
  let best: { chapter?: Chapter; subject?: string; score: number } = { score: 0 }
  for (const s of subjects) {
    for (const c of s.chapters) {
      const hay = `${c.title} ${c.learning_outcomes.map((o) => o.text).join(' ')}`.toLowerCase()
      const score = tokens.filter((t) => hay.includes(t)).length
      if (score > best.score) best = { chapter: c, subject: s.name, score }
    }
  }
  return best.score > 0 ? { chapter: best.chapter, subject: best.subject } : {}
}

/** Predefined cross-grade shared groups for the compiler (curriculum-aware). */
export const SHARED_TOPICS: { key: string; label: string; grades: string[] }[] = [
  { key: 'num', label: 'Number sense (shared)', grades: ['1', '2', '3'] },
  { key: 'shape', label: 'Shapes & patterns (shared)', grades: ['1', '2', '3', '4', '5'] },
  { key: 'lang', label: 'Reading & oral language (shared)', grades: ['1', '2', '3', '4', '5'] },
  { key: 'evs', label: 'Environment & living world (shared)', grades: ['1', '2', '3', '4', '5'] },
]
