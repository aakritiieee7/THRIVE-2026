import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import { useStoredState } from '../lib/storage'
import { api } from '../lib/api'
import { fetchChapters, matchChapter, SHARED_TOPICS, SubjectChapters } from '../lib/curriculum'
import {
  IconAlert, IconCheck, IconClipboard, IconClock, IconCopy, IconDownload, IconEdit,
  IconLayers, IconPlus, IconPrint, IconRefresh, IconSave, IconSparkle, IconX,
} from '../components/Icons'

type GradePlan = { grade: string; topic: string; objective: string; shared: string }
type Lane = { who: string; doing: string; is_teacher?: string }
type Slot = { start: number; end: number; focus: string; grades: string[]; objective: string; teacher: string; activity: string; materials: string; check: string; kind: string; lanes?: Lane[]; early_finishers?: string }
type PlanResult = { slots: Slot[]; assessments: { grade: string; prompt: string; follow_up: string }[]; engine: string; sources: { kind: string; note: string }[] }

const fmt = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
const SUBJECTS = ['Mathematics', 'Environmental Studies', 'Language', 'Science', 'Social Science']
const BOARDS = ['Bihar SCERT', 'NCERT', 'Other — teacher-provided goals']
const MEDIA = ['Hindi', 'English', 'Hindi + English']
const TIME_CHIPS = [30, 35, 40, 45, 50, 60]

const MIN_TURN = 5, MIN_OPEN = 4, MIN_CLOSE = 6

export default function Compiler() {
  const [profile] = useStoredState<any>('profile', { board: '', medium: '' })
  const [grades, setGrades] = useState<GradePlan[]>([
    { grade: '3', topic: 'Shapes and Patterns', objective: 'Recognize common 2D shapes and create a repeating pattern', shared: '' },
    { grade: '5', topic: 'Fractions', objective: 'Represent and compare simple fractions using paper folding', shared: '' },
  ])
  const [minutes, setMinutes] = useState(45)
  const [subject, setSubject] = useState('Mathematics')
  const [medium, setMedium] = useState(profile.medium || 'Hindi')
  const [board, setBoard] = useState(profile.board || 'Bihar SCERT')
  const [materials, setMaterials] = useState('paper, chalk, classroom objects')
  const [buffer, setBuffer] = useState(0)
  const [plan, setPlan] = useState<PlanResult | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [genError, setGenError] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [savedPlans, setSavedPlans] = useStoredState<any[]>('plans', [])
  const [toast, setToast] = useState('')
  const [catalogs, setCatalogs] = useState<Record<string, SubjectChapters[] | null>>({})

  function setGrade(i: number, key: keyof GradePlan, value: string) {
    setGrades(old => old.map((g, n) => n === i ? { ...g, [key]: value } : g))
  }

  // Curriculum chapters per grade → contextual topic suggestions + outcome chips.
  useEffect(() => {
    let live = true
    ;(async () => {
      for (const g of grades) {
        const key = g.grade
        if (catalogs[key] !== undefined) continue
        const data = await fetchChapters(key, subject)
        if (live) setCatalogs(c => ({ ...c, [key]: data }))
      }
    })()
    return () => { live = false }
  }, [grades.map(g => g.grade).join(','), subject])

  function pickTopic(i: number, value: string) {
    setGrade(i, 'topic', value)
    const g = grades[i]
    const { chapter } = matchChapter(value, catalogs[g.grade])
    if (chapter && value.trim().length > 3) {
      const first = chapter.learning_outcomes[0]?.text
      if (first) setGrade(i, 'objective', first)
    }
  }

  function addGrade() {
    if (grades.length >= 6) return
    const used = new Set(grades.map(g => g.grade))
    const next = Array.from({ length: 12 }, (_, i) => String(i + 1)).find(g => !used.has(g)) || String(grades.length + 1)
    setGrades([...grades, { grade: next, topic: '', objective: '', shared: '' }])
  }

  function removeGrade(i: number) {
    if (grades.length <= 1) return
    setGrades(grades.filter((_, n) => n !== i))
  }

  /* ── live feasibility (mirrors the engine's minimums) ───────────── */
  const feasibility = useMemo(() => {
    const n = grades.length
    const errs: string[] = []
    if (!Number.isInteger(minutes) || minutes < 20 || minutes > 240)
      errs.push('Class time must be between 20 and 240 minutes.')
    if (n < 1 || n > 6) errs.push('Between 1 and 6 grade groups are supported.')
    if (new Set(grades.map(g => g.grade.trim())).size !== n) errs.push('Each grade may appear only once.')
    grades.forEach((g, i) => {
      if (!g.topic.trim()) errs.push(`Grade ${g.grade || i + 1}: topic is required.`)
      if (!g.objective.trim()) errs.push(`Grade ${g.grade || i + 1}: learning goal is required.`)
    })
    const need = MIN_OPEN + MIN_CLOSE + n * MIN_TURN + Math.max(0, n - 1) * buffer
    if (minutes < need)
      errs.push(`${minutes} minutes is not enough for ${n} grade group${n > 1 ? 's' : ''}: at least ${need} minutes are needed.`)
    const ok = errs.length === 0
    return { ok, errs, need, n, pct: Math.min(100, Math.round(minutes / Math.max(need, minutes) * 100)) }
  }, [grades, minutes, buffer])

  async function generate() {
    setGenError([]); setPlan(null); setFieldErrors({})
    if (!feasibility.ok) {
      const fe: Record<string, string> = {}
      if (minutes < 20 || minutes > 240 || !Number.isInteger(minutes)) fe.minutes = 'Choose 20–240 minutes.'
      grades.forEach((g, i) => {
        if (!g.topic.trim()) fe[`topic-${i}`] = 'Topic required.'
        if (!g.objective.trim()) fe[`objective-${i}`] = 'Learning goal required.'
        if (grades.findIndex(x => x.grade === g.grade) !== i) fe[`grade-${i}`] = 'Duplicate grade.'
      })
      setFieldErrors(fe)
      setGenError(feasibility.errs)
      requestAnimationFrame(() =>
        document.getElementById('studio-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      return
    }
    setBusy(true)
    try {
      const body = {
        subject, medium, board, minutes, materials, transition_buffer: buffer,
        grades: grades.map(g => ({ grade: g.grade, topic: g.topic, objective: g.objective, shared_group: g.shared || null })),
      }
      const r = await api.post('/api/compiler/run', body)
      setPlan(r as PlanResult)
      requestAnimationFrame(() =>
        document.getElementById('plan-output')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (err: any) {
      // 422 = the engine refused the inputs. Show every reason, verbatim.
      if (err?.status === 422) setGenError(Array.isArray(err.message) ? err.message : [String(err.message)])
      else setGenError([err?.message || 'Could not reach the compiler service. Check that the backend is running and retry.'])
    } finally { setBusy(false) }
  }

  async function save() {
    if (!plan) return
    const title = `${subject}: ${grades.map(g => `Grade ${g.grade}`).join(' & ')}`
    const item = {
      title, grades, minutes, subject, medium, board, materials, buffer,
      schedule: plan.slots, assessments: plan.assessments, sources: plan.sources,
      savedAt: new Date().toISOString(),
    }
    try {
      const r = await api.post('/api/plans', { title, subject, medium, board, minutes, payload: item })
      setSavedPlans([{ ...item, id: r.id, server: true }, ...savedPlans.filter(p => p.id !== r.id)])
    } catch {
      setSavedPlans([{ ...item, id: Date.now() }, ...savedPlans])
    }
    setToast('Lesson plan saved to My resources'); setTimeout(() => setToast(''), 2600)
  }

  function planAsText() {
    if (!plan) return ''
    const lines = [
      `${subject} · ${medium} · ${board} — ${minutes} minutes`,
      grades.map(g => `Grade ${g.grade}: ${g.topic} — ${g.objective}`).join('\n'),
      '', 'Schedule:',
      ...plan.slots.map(s =>
        `${fmt(s.start)}–${fmt(s.end)} (${s.end - s.start} min) [${s.kind}] ${s.focus}\n  ${s.teacher}: ${s.activity}\n  Check: ${s.check}`),
      '', 'Assessments:',
      ...plan.assessments.map(a => `Grade ${a.grade}: ${a.prompt} — ${a.follow_up}`),
      '', ...plan.sources.map(s => s.note),
    ]
    return lines.join('\n')
  }

  function exportCsv() {
    if (!plan) return
    const rows = [['Start', 'End', 'Kind', 'Group', 'Learning goal', 'Teacher role', 'Activity', 'Materials', 'Check'],
    ...plan.slots.map(s => [fmt(s.start), fmt(s.end), s.kind, s.focus, s.objective, s.teacher, s.activity, s.materials, s.check])]
    const csv = rows.map(r => r.map(x => '"' + String(x).replaceAll('"', '""') + '"').join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'thrive-multigrade-plan.csv'; a.click(); URL.revokeObjectURL(a.href)
  }

  async function copyPlan() {
    if (!plan) return
    try { await navigator.clipboard.writeText(planAsText()); setToast('Lesson plan copied to clipboard') }
    catch { setToast('Could not copy — your browser blocked clipboard access') }
    setTimeout(() => setToast(''), 2600)
  }

  const sharedKeys = useMemo(() => {
    const m: Record<string, string[]> = {}
    grades.forEach(g => { if (g.shared) (m[g.shared] ||= []).push(g.grade) })
    return m
  }, [grades])

  /* Resolution advice for refused inputs: concrete, computable next steps. */
  const resolution = useMemo(() => {
    if (!genError.length) return [] as string[]
    const n = grades.length, out: string[] = []
    if (feasibility.need > minutes) out.push(`Raise class time from ${minutes} to at least ${feasibility.need} minutes.`)
    if (n > 1) out.push(`Or drop to ${n - 1} grade group${n - 1 > 1 ? 's' : ''} for this period and teach Grade ${grades[n - 1].grade} separately.`)
    if (buffer > 0) {
      const alt = MIN_OPEN + MIN_CLOSE + n * MIN_TURN + Math.max(0, n - 1) * (buffer - 1)
      if (alt <= minutes) out.push(`Or reduce the transition buffer from ${buffer} to ${buffer - 1} minutes (fits in ${alt} min).`)
    }
    return out
  }, [genError, feasibility.need, minutes, grades, buffer])

  /* Labelled demonstration: 1 teacher · Grades 3, 4, 5 · Mathematics · 45 min. */
  function loadDemo() {
    setSubject('Mathematics'); setMinutes(45); setBuffer(0)
    setMaterials('paper, chalk, classroom objects')
    setGrades([
      { grade: '3', topic: 'Shapes and Patterns', objective: 'Recognize common 2D shapes and create a repeating pattern', shared: '' },
      { grade: '4', topic: 'Numbers up to 1000', objective: 'Read, write and place three-digit numbers on a number line', shared: '' },
      { grade: '5', topic: 'Fractions', objective: 'Represent and compare simple fractions using paper folding', shared: '' },
    ])
    setGenError([]); setPlan(null); setFieldErrors({})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return <Layout title="Curriculum Studio">
    <div className="page-heading">
      <div>
        <div className="eyebrow">Curriculum Studio · multi-grade compiler</div>
        <h1>One classroom. One coordinated plan.</h1>
        <p>Constraint-checked schedules across your grade groups — shared openings only when goals genuinely align, a teacher-led turn for every grade, and exact minute accounting.</p>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn no-print" onClick={loadDemo} title="Load the illustrative demo scenario (labelled content)">
          <IconClipboard size={14} /> Load demo scenario
        </button>
        <Link href="/guided" className="btn no-print"><IconSparkle size={14} /> Guided walkthrough</Link>
      </div>
    </div>

    <div className="notice notice-warn" style={{ marginBottom: 16 }}>
      <b>Curriculum coverage is partial.</b> Seeded NCERT-aligned chapters for Grades 1–5 (Mathematics, Environmental Studies).
      Bihar SCERT content has not been ingested — teacher-entered goals are treated as context, and every suggestion should be
      reviewed against your official syllabus.
    </div>

    <div className="grid studio-grid">
      {/* ── FORM ──────────────────────────────────────────────── */}
      <section className="panel" id="studio-form">
        <div className="panel-title">
          <div><h2>Set up your classroom</h2><p>Plan around the whole room, not a separate lesson per grade.</p></div>
          <span className="tag">Plan a period</span>
        </div>

        {/* Context strip */}
        <div className="summary-strip" aria-hidden="true">
          <div><b>{grades.length}</b><small>Grade groups</small></div>
          <div><b>{minutes} min</b><small>Class time</small></div>
          <div><b>{buffer} min</b><small>Transitions</small></div>
          <div><b>{feasibility.ok ? 'Ready' : 'Needs input'}</b><small>Feasibility</small></div>
        </div>

        <div className="context-row" style={{ marginBottom: 4 }}>
          <div className="field">
            <label htmlFor="board">Curriculum / board</label>
            <select id="board" value={board} onChange={e => setBoard(e.target.value)}>
              {BOARDS.map(b => <option key={b}>{b}</option>)}
            </select>
            <span className="hint">Seeded chapters are NCERT-aligned; other boards use your goals as context.</span>
          </div>
          <div className="field">
            <label htmlFor="medium">Medium of instruction</label>
            <select id="medium" value={medium} onChange={e => setMedium(e.target.value)}>
              {MEDIA.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="subject">Subject</label>
            <select id="subject" value={subject} onChange={e => setSubject(e.target.value)}>
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className={'field' + (fieldErrors.minutes ? ' invalid' : '')}>
            <label htmlFor="minutes">Available class time</label>
            <input id="minutes" type="number" min={20} max={240} value={minutes}
              onChange={e => { setMinutes(Number(e.target.value) || 0); setFieldErrors({ ...fieldErrors, minutes: '' }) }}
              aria-invalid={!!fieldErrors.minutes} />
            {fieldErrors.minutes && <span className="hint" style={{ color: 'var(--clay)' }}>{fieldErrors.minutes}</span>}
          </div>
        </div>

        <div className="time-chips" style={{ marginBottom: 18 }}>
          {TIME_CHIPS.map(t =>
            <button key={t} className={'time-chip' + (minutes === t ? ' sel' : '')} onClick={() => { setMinutes(t); setFieldErrors({ ...fieldErrors, minutes: '' }) }}>
              {t} min
            </button>)}
        </div>

        {/* Feasibility strip — live, before generation */}
        <div className={'feasibility-strip ' + (feasibility.ok ? 'ok' : 'bad')} role="status">
          {feasibility.ok ? <IconCheck size={16} /> : <IconAlert size={16} />}
          <span>{feasibility.ok
            ? `${minutes} minutes covers the ${feasibility.need}-minute minimum for ${feasibility.n} group${feasibility.n > 1 ? 's' : ''}.`
            : feasibility.errs[0]}</span>
          <span className="bar"><i style={{ width: `${feasibility.pct}%` }} /></span>
          <span>{minutes} / {feasibility.need} min</span>
        </div>

        {/* Grade groups */}
        <div className="spread" style={{ margin: '4px 0 11px' }}>
          <div>
            <b style={{ fontSize: 12.5, fontFamily: "'Fraunces'" }}>Grade groups &amp; learning goals</b>
            <div className="muted" style={{ fontSize: 10.5, marginTop: 3 }}>
              Pick a seeded chapter or enter your own goal — objectives auto-fill from curriculum outcomes when matched.
            </div>
          </div>
          <span className="tag">{grades.length} / 6 groups</span>
        </div>

        {grades.map((g, i) => {
          const subjects = catalogs[g.grade]
          const { chapter, subject: chSubject } = matchChapter(g.topic, subjects)
          const dup = fieldErrors[`grade-${i}`]
          return <div className="grade-card" key={`${i}-${g.grade}`}>
            <div className="grade-card-head">
              <span className="grade-chip">{g.grade}</span>
              <div>
                <b>Grade {g.grade} group</b>
                <small>{g.shared ? SHARED_TOPICS.find(s => s.key === g.shared)?.label : 'Taught separately'}</small>
              </div>
            </div>
            {grades.length > 1 &&
              <button className="remove" aria-label={`Remove Grade ${g.grade} group`} onClick={() => removeGrade(i)}>
                <IconX size={13} />
              </button>}

            <div className="context-row" style={{ gridTemplateColumns: '110px 1.2fr 1.4fr' }}>
              <div className={'field' + (dup ? ' invalid' : '')}>
                <label htmlFor={`grade-${i}`}>Grade</label>
                <select id={`grade-${i}`} value={g.grade} onChange={e => { setGrade(i, 'grade', e.target.value); setFieldErrors({ ...fieldErrors, [`grade-${i}`]: '' }) }}>
                  {Array.from({ length: 12 }, (_, n) => <option key={n + 1} value={n + 1}>{n + 1}</option>)}
                </select>
                {dup && <span className="hint" style={{ color: 'var(--clay)' }}>{dup}</span>}
              </div>

              <div className={'field' + (fieldErrors[`topic-${i}`] ? ' invalid' : '')}>
                <label htmlFor={`topic-${i}`}>Topic or chapter</label>
                <input id={`topic-${i}`} list={`topics-${i}`} value={g.topic}
                  onChange={e => pickTopic(i, e.target.value)}
                  placeholder={catalogs[g.grade] ? 'e.g. Shapes and Patterns' : 'Enter a topic — curriculum list loading…'}
                  aria-invalid={!!fieldErrors[`topic-${i}`]} />
                <datalist id={`topics-${i}`}>
                  {(subjects ?? []).flatMap(s => s.chapters.map(c => <option key={c.id} value={c.title} />))}
                </datalist>
                {fieldErrors[`topic-${i}`] && <span className="hint" style={{ color: 'var(--clay)' }}>{fieldErrors[`topic-${i}`]}</span>}
                {chapter && <span className="match-note"><IconCheck size={12} /> Curriculum match: {chSubject} · {chapter.id} · {chapter.learning_outcomes.length} outcomes</span>}
                {!chapter && g.topic.trim() && <span className="match-note teachernote">Teacher-provided goal — not from the seeded corpus</span>}
              </div>

              <div className={'field' + (fieldErrors[`objective-${i}`] ? ' invalid' : '')}>
                <label htmlFor={`objective-${i}`}>Learning goal</label>
                <input id={`objective-${i}`} value={g.objective}
                  onChange={e => setGrade(i, 'objective', e.target.value)}
                  placeholder="What will learners do and show?"
                  aria-invalid={!!fieldErrors[`objective-${i}`]} />
                {fieldErrors[`objective-${i}`] && <span className="hint" style={{ color: 'var(--clay)' }}>{fieldErrors[`objective-${i}`]}</span>}
                {chapter?.learning_outcomes.length > 0 &&
                  <div className="outcome-chips">
                    {chapter.learning_outcomes.slice(0, 3).map(o =>
                      <button type="button" className="outcome-chip" key={o.id}
                        onClick={() => setGrade(i, 'objective', o.text)}
                        title="Use this curriculum outcome as the learning goal">✓ {o.text}</button>)}
                  </div>}
              </div>
            </div>

            <div className="field" style={{ marginBottom: 0, marginTop: 2 }}>
              <label htmlFor={`shared-${i}`}>Shared group</label>
              <select id={`shared-${i}`} value={g.shared} onChange={e => setGrade(i, 'shared', e.target.value)}>
                <option value="">Taught separately (no shared opening)</option>
                {SHARED_TOPICS.filter(s => s.grades.includes(g.grade)).map(s =>
                  <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <span className="hint">Grades only share an opening when they share the same group — never forced.</span>
            </div>
          </div>
        })}

        <button className="add-grade" onClick={addGrade} disabled={grades.length >= 6}>
          <IconPlus size={14} /> Add another grade group
        </button>
        {Object.keys(sharedKeys).length > 0 &&
          <div className="match-note" style={{ marginTop: 10 }}>
            <IconLayers size={12} />
            {Object.entries(sharedKeys).map(([k, gs]) => `${SHARED_TOPICS.find(s => s.key === k)?.label || k}: Grades ${gs.join(', ')}`).join(' · ')}
            {' — these grades open together; each still gets its own turn.'}
          </div>}

        {/* Materials + transitions */}
        <div className="divider" />
        <div className="context-row" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
          <div className="field">
            <label htmlFor="materials">Teaching materials available</label>
            <input id="materials" value={materials} onChange={e => setMaterials(e.target.value)}
              placeholder="e.g. seeds, paper, chalk, number cards" />
            <span className="hint">Every suggestion uses only these — nothing invented.</span>
          </div>
          <div className="field">
            <label htmlFor="buffer">Transition time between groups</label>
            <input id="buffer" type="number" min={0} max={15} value={buffer}
              onChange={e => setBuffer(Math.max(0, Math.min(15, Number(e.target.value) || 0)))} />
            <span className="hint">Minutes for material swaps — budgeted out of your period.</span>
          </div>
        </div>

        {genError.length > 0 &&
          <div className="notice notice-error" style={{ marginBottom: 13 }} role="alert">
            <b>The compiler refused these inputs.</b>
            <div style={{ marginTop: 5 }}>
              {genError.filter(e => !e.startsWith('Resolve it by:')).map((e, i) => <div key={i}>• {e}</div>)}
            </div>
            <div style={{ marginTop: 6 }}>Infeasible schedules are rejected, never faked — adjust the flagged inputs and try again.</div>
            {(() => {
              const engineFix = genError.find(e => e.startsWith('Resolve it by:'))
              const hints = [
                ...(engineFix ? [engineFix.replace('Resolve it by: ', '')] : []),
                ...resolution,
              ]
              if (!hints.length) return null
              return <div className="advice">
                <b>Ways to resolve the conflict</b>
                <ul>{hints.map((h, i) => <li key={i}>{h}</li>)}</ul>
              </div>
            })()}
          </div>}

        <div className="row" style={{ gap: 9 }}>
          <button className="btn btn-primary" onClick={generate} disabled={busy} style={{ padding: '11px 22px' }}>
            {busy ? <><IconRefresh size={14} /> Compiling schedule…</> : <><IconSparkle size={14} /> Generate coordinated plan</>}
          </button>
          {plan && <button className="btn" onClick={() => { setPlan(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            <IconRefresh size={14} /> Start a new plan
          </button>}
        </div>
      </section>

      {/* ── GUARDRAILS ─────────────────────────────────────────── */}
      <aside className="panel no-print">
        <div className="panel-title">
          <div><h2>Planning guardrails</h2><p>Enforced by the constraint engine</p></div>
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <span className="tag tag-green">01</span>
            <div><b style={{ fontSize: 11.5 }}>Exact fit</b>
              <div className="muted" style={{ fontSize: 10.5, lineHeight: 1.6, marginTop: 4 }}>
                The plan fills exactly {minutes} minutes — impossible inputs are rejected with explicit reasons.</div></div>
          </div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <span className="tag tag-green">02</span>
            <div><b style={{ fontSize: 11.5 }}>One teacher, one turn</b>
              <div className="muted" style={{ fontSize: 10.5, lineHeight: 1.6, marginTop: 4 }}>
                Attention is never double-booked. Waiting groups get independent tasks, not worksheets to sit on.</div></div>
          </div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <span className="tag tag-green">03</span>
            <div><b style={{ fontSize: 11.5 }}>No forced merging</b>
              <div className="muted" style={{ fontSize: 10.5, lineHeight: 1.6, marginTop: 4 }}>
                Grades are taught together only when you mark a genuine shared group.</div></div>
          </div>
        </div>
        <div className="divider" />
        <div className="notice">
          <b>Minute budget:</b> {feasibility.need} min minimum = {MIN_OPEN} min opening + {MIN_CLOSE} min closing
          + {MIN_TURN} min per group{buffer ? ` + ${buffer} min transitions` : ''}.
        </div>
        <div className="divider" />
        <div className="panel-title" style={{ marginBottom: 8 }}>
          <div><h2 style={{ fontSize: 14 }}>Curriculum ground truth</h2></div>
        </div>
        <div className="source-line">
          <span><IconCheck size={12} /> Grades 1–5 · Mathematics (2 chapters/grade)</span>
          <span><IconCheck size={12} /> Grades 1, 3, 5 · Environmental Studies</span>
          <span><IconAlert size={12} /> Bihar SCERT — not ingested, use as context only</span>
        </div>
      </aside>
    </div>

    {/* ── GENERATED PLAN ──────────────────────────────────────── */}
    {plan && <section className="panel" id="plan-output" style={{ marginTop: 18 }}>
      <div className="plan-hero">
        <div>
          <div className="eyebrow">Coordinated classroom schedule</div>
          <h2>{subject} · Grades {grades.map(g => g.grade).join(' & ')}</h2>
          <p>{medium} · {board} · engine: {plan.engine}</p>
        </div>
        <div className="plan-actions no-print">
          <button className="btn btn-small" onClick={() =>
            document.getElementById('studio-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            <IconEdit size={13} /> Edit inputs</button>
          <button className="btn btn-small" onClick={generate} disabled={busy}>
            <IconRefresh size={13} /> {busy ? 'Compiling…' : 'Regenerate'}</button>
          <button className="btn btn-small" onClick={copyPlan}><IconCopy size={13} /> Copy</button>
          <button className="btn btn-small" onClick={() => window.print()}><IconPrint size={13} /> Print</button>
          <button className="btn btn-small" onClick={exportCsv}><IconDownload size={13} /> CSV</button>
          <button className="btn btn-small btn-primary" onClick={save}><IconSave size={13} /> Save plan</button>
        </div>
      </div>

      {/* Overview stats */}
      <div className="plan-stats">
        <div><b>{minutes}</b><small>Total minutes</small></div>
        <div><b>{plan.slots.length}</b><small>Stages</small></div>
        <div><b>{grades.length}</b><small>Grade groups</small></div>
        <div><b>{plan.assessments.length}</b><small>Assessments</small></div>
      </div>

      {/* Legend */}
      <div className="legend">
        <span><span className="phase-badge pb-opening">Opening</span> whole class</span>
        <span><span className="phase-badge pb-turn">Teacher turn</span> one grade at a time</span>
        {buffer > 0 && <span><span className="phase-badge pb-transition">Transition</span> material swap</span>}
        <span><span className="phase-badge pb-closing">Closing</span> check for all</span>
        <span>Lanes show <b style={{ color: 'var(--forest-deep)' }}>you</b> and every grade at the same moment — one focus, never double-booked</span>
      </div>

      {/* Minute-by-minute timeline */}
      <div className="timeline">
        {plan.slots.map((s, i) => {
          const cls = s.kind === 'opening' ? ' pb-opening-b' : s.kind === 'closing' ? ' pb-closing-b' : s.kind === 'transition' ? ' pb-transition-b' : ''
          const lanes = s.lanes && s.lanes.length
            ? s.lanes
            : (s.kind === 'turn'
              ? [{ who: 'You (teacher)', doing: 'Teacher-led focus', is_teacher: '1' },
              ...s.grades.filter(g => g !== s.focus).map(g => ({ who: g, doing: 'Independent work', is_teacher: '' }))]
              : [])
          return <div className={'tl-row' + cls} key={i}>
            <div className="tl-time">
              <b>{fmt(s.start)}–{fmt(s.end)}</b>
              <small>{s.end - s.start} min</small>
              <span className={'phase-badge pb-' + s.kind}>{s.kind}</span>
            </div>
            <div className="tl-body">
              <b>{s.focus}</b>
              <div className="role">{s.teacher} · {s.objective}</div>
              <p>{s.activity}</p>
              {lanes.length > 0 &&
                <div className="lanes">
                  {lanes.map((l, n) =>
                    <div className={'lane' + (l.is_teacher ? '' : ' muted-lane')} key={n}>
                      <span className="who">{l.who}</span>
                      <span className="doing">{l.doing}</span>
                    </div>)}
                </div>}
              {s.early_finishers &&
                <div className="indep-list" style={{ marginTop: 8 }}>
                  <div className="indep-item"><IconClock size={14} />
                    <span><b>Early finishers:</b> {s.early_finishers}</span>
                  </div>
                </div>}
              <div className="tl-check"><IconCheck size={13} /> {s.check}</div>
            </div>
          </div>
        })}
      </div>

      {/* Materials */}
      <div className="divider" />
      <div className="panel-title" style={{ marginBottom: 8 }}>
        <div><h2 style={{ fontSize: 15 }}>Materials required</h2></div>
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 7 }}>
        {materials.split(',').map((m, i) => m.trim() && <span className="tag tag-green" key={i}>{m.trim()}</span>)}
        {buffer > 0 && <span className="tag tag-honey">{buffer} min transitions between groups</span>}
      </div>

      {/* Assessments */}
      <div className="divider" />
      <div className="panel-title" style={{ marginBottom: 8 }}>
        <div><h2 style={{ fontSize: 15 }}>Learning outcomes &amp; quick checks</h2>
          <p>One prompt per grade group — use at the closing check.</p></div>
      </div>
      <div className="assess-grid">
        {plan.assessments.map(a =>
          <div className="assess-card" key={a.grade}>
            <b>Grade {a.grade} · assessment</b>
            <p>{a.prompt}</p>
            <small>{a.follow_up}</small>
          </div>)}
      </div>

      {/* Sources */}
      <div className="divider" />
      <div className="source-line">
        {plan.sources.map((s, i) =>
          <span key={i}><IconCheck size={12} /> {s.note}</span>)}
        <span><IconAlert size={12} /> Seeded curriculum: NCERT-aligned Grades 1–5, Mathematics &amp; EVS only — confirm against your official syllabus.</span>
      </div>
    </section>}

    {toast && <div className="toast"><IconCheck size={14} /> {toast}</div>}
  </Layout>
}
