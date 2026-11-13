import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import { getToken } from '../lib/api'
import { useStoredState, EMPTY_PROFILE } from '../lib/storage'
import { fetchPlans, mergePlans } from '../lib/plans'
import { backendUp } from '../lib/api'
import { trainingCourses } from '../lib/storage'
import { getGuest } from '../lib/guest'
import {
  IconArrow, IconBook, IconChat, IconClock, IconFolder, IconLayers,
  IconPlus, IconSparkle, IconStudio, IconUsers, IconWand, IconClipboard,
} from '../components/Icons'

const fmt = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`

export default function Home() {
  const router = useRouter()
  const [plans, setPlans] = useStoredState<any[]>('plans', [])
  const [profile] = useStoredState<any>('profile', EMPTY_PROFILE)
  const [progress] = useStoredState<Record<string, number>>('training-progress', {})
  const [greeting, setGreeting] = useState('Good morning')
  const [day, setDay] = useState('')
  const [status, setStatus] = useState<'checking' | 'online' | 'local'>('checking')
  // Who is at the desk: a signed-in teacher, a guest exploring, or a first
  // visitor. Each gets an honest greeting — nothing is pre-claimed.
  const [signedIn, setSignedIn] = useState(false)
  const [isGuest, setIsGuest] = useState(false)

  useEffect(() => {
    setSignedIn(!!getToken())
    setIsGuest(!!getGuest())
  }, [router.pathname])

  // Pull saved plans from the account or guest session so the dashboard shows
  // real work, merged over whatever this device already mirrors.
  const plansRef = useRef(plans)
  plansRef.current = plans
  useEffect(() => {
    ;(async () => {
      const rows = await fetchPlans()
      if (rows.length) setPlans(mergePlans(plansRef.current, rows))
    })()
  }, [])

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
    setDay(new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }))
    backendUp().then((ok) => setStatus(ok ? 'online' : 'local'))
  }, [])

  const gradeList = (profile.grades || '').split(',').map((g: string) => g.trim()).filter(Boolean)
  const firstName = (profile.name || '').trim().split(/\s+/)[0] || ''
  const hasContext = !!(profile.state || profile.board || profile.medium || gradeList.length)
  const lessonsDone = Object.values(progress).reduce((a, b) => a + b, 0)
  const lessonsTotal = trainingCourses.reduce((a, c) => a + c.lesson.length, 0)
  const activeCourse = trainingCourses.find(c => (progress[c.id] || 0) > 0 && (progress[c.id] || 0) < c.lesson.length)
  const contextTags = [
    (profile.state || profile.board) ? [profile.state, profile.board].filter(Boolean).join(' · ') : '',
    profile.medium || '',
    gradeList.length ? `Grades ${gradeList.join(', ')}` : '',
    profile.subjects || '',
  ].filter(Boolean)

  return <Layout title="Home">
    {/* ── Greeting band: the workspace's front door ─────────────── */}
    <div className="greet-band">
      <div className="date-line">
        {day || 'Today'}
        <span aria-hidden="true">·</span>
        {status === 'checking' ? 'checking your workspace…' : status === 'online' ? 'workspace online' : 'saved on this device'}
      </div>
      <h1>{greeting}{firstName ? `, ${firstName}` : ''}.</h1>
      {signedIn
        ? <p>Plan one coordinated period across every grade in your room — or pick up where you left off.</p>
        : isGuest
          ? <p>You're exploring as a guest — everything you save stays on this device until you create an account.</p>
          : <p>Plan one coordinated period across every grade in your room. Save plans, progress and context with a free teacher account.</p>}
      <div className="greet-actions">
        <Link href="/compiler" className="btn btn-sun"><IconPlus size={14} /> Create a lesson plan</Link>
        <Link href="/assistant" className="btn"><IconChat size={14} /> Ask the teaching assistant</Link>
        {!signedIn && !isGuest && <>
          <Link href="/login" className="btn"><IconUsers size={14} /> Sign in</Link>
          <Link href="/try" className="btn">Try as guest</Link>
        </>}
        {plans.length > 0 && <Link href="/resources" className="btn">Continue working ({plans.length} saved)</Link>}
      </div>
      {!signedIn && !isGuest && day && (
        <p className="muted" style={{ fontSize: 10.5, marginTop: 10 }}>
          New here? <Link href="/guided" className="text-link">Guided setup</Link> walks you through your first lesson.
        </p>
      )}
    </div>

    {/* ── Primary shortcuts ─────────────────────────────────────── */}
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', marginBottom: 4 }}>
      <Link href="/compiler" className="tile-card">
        <span className="tile-icon t-green"><IconStudio size={19} /></span>
        <b>Curriculum Studio</b>
        <small>Constraint-checked multi-grade schedules built around your classroom time and grade groups.</small>
        <span className="tile-link">Open studio <IconArrow size={12} /></span>
      </Link>
      <Link href="/assistant" className="tile-card">
        <span className="tile-icon t-honey"><IconWand size={19} /></span>
        <b>Teaching Assistant</b>
        <small>Context-aware teaching moves with sources on every reply — type or speak.</small>
        <span className="tile-link">Ask a question <IconArrow size={12} /></span>
      </Link>
      <Link href="/guided" className="tile-card">
        <span className="tile-icon t-sage"><IconSparkle size={19} /></span>
        <b>Guided setup</b>
        <small>New here? Build your first lesson in five short stages with a worked example.</small>
        <span className="tile-link">Start guided <IconArrow size={12} /></span>
      </Link>
    </div>

    {/* ── Recent plans ──────────────────────────────────────────── */}
    <div className="grid dashboard-grid" style={{ marginTop: 20 }}>
      <section className="panel">
        <div className="panel-title">
          <div><h2>Recent lesson plans</h2><p>Pick up where you left off</p></div>
          <Link href="/resources" className="text-link">All resources</Link>
        </div>
        {plans.length
          ? <div className="plan-list">
            {plans.slice(0, 4).map((p: any) =>
              <Link href="/resources" className="plan-item" key={p.id}>
                <span className="plan-icon"><IconStudio size={15} /></span>
                <span>
                  <b>{p.title || 'Multi-grade lesson plan'}</b>
                  <small>
                    {p.grades?.length
                      ? p.grades.map((g: any) => `Grade ${g.grade}`).join(' · ')
                      : p.subject || 'Classroom plan'}
                    {' · '}{p.minutes || 40} min
                  </small>
                </span>
                <span className="right"><small>{p.savedAt ? 'Saved' : 'Draft'}</small></span>
              </Link>)}
          </div>
          : <div className="empty">
            <IconClipboard size={34} />
            <div>Your lesson plans will appear here once you save one.</div>
            <Link href="/compiler" className="btn btn-primary btn-small" style={{ marginTop: 12 }}>
              <IconPlus size={13} /> Create your first plan
            </Link>
          </div>}
      </section>

      <div style={{ display: 'grid', gap: 14 }}>
        {/* Ongoing learning */}
        <section className="panel">
          <div className="panel-title">
            <div><h2>Keep learning</h2>
              <p>{lessonsDone > 0 ? `${lessonsDone} of ${lessonsTotal} lessons done` : 'Nothing started yet'}</p></div>
            <Link href="/training" className="text-link">Training</Link>
          </div>
          {/* Honest progress: no bar at 0 — a claim of progress needs progress. */}
          {lessonsDone > 0
            ? <div className="progress-line"><i style={{ width: `${Math.min(100, Math.round(lessonsDone / lessonsTotal * 100))}%` }} /></div>
            : <div className="muted" style={{ fontSize: 10.5, marginTop: 8, lineHeight: 1.6 }}>
              Short practice courses start in the Training centre — progress appears here once you begin.
            </div>}
          {activeCourse
            ? <Link href="/training" className="plan-item" style={{ marginTop: 12 }}>
              <span className="plan-icon"><IconBook size={15} /></span>
              <span><b>{activeCourse.title}</b>
                <small>{progress[activeCourse.id]} / {activeCourse.lesson.length} lessons · continue</small></span>
              <span className="right"><IconArrow size={14} /></span>
            </Link>
            : <div className="muted" style={{ fontSize: 11, marginTop: 11, lineHeight: 1.6 }}>
              No course in progress. {trainingCourses.length} short courses are waiting in the Training centre.
            </div>}
        </section>

        {/* Teaching context */}
        <section className="panel">
          <div className="panel-title">
            <div><h2>Your teaching context</h2><p>Used to tailor suggestions</p></div>
            <Link href="/profile" className="text-link">Edit</Link>
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 7 }}>
            {contextTags.length
              ? <>
                {contextTags.slice(0, 2).map((t, i) => <span className="tag tag-green" key={i}>{t}</span>)}
                {contextTags.slice(2).map((t, i) => <span className={'tag' + (i === 0 && gradeList.length ? ' tag-honey' : '')} key={i + 2}>{t}</span>)}
              </>
              : <div className="empty" style={{ padding: '14px 10px' }}>
                No teaching context yet — set your state, board and grades so suggestions fit your classroom.
                <Link href="/profile" className="btn btn-small" style={{ marginTop: 10 }}>Set your context</Link>
              </div>}
          </div>
          <p className="muted" style={{ fontSize: 10.5, lineHeight: 1.6, marginTop: 12 }}>
            Included curriculum: NCERT-aligned Grades 1–5 (Mathematics, EVS). Bihar SCERT content is not
            included yet — confirm against your official syllabus.
          </p>
        </section>
      </div>
    </div>

    {/* ── Shortcuts ─────────────────────────────────────────────── */}
    <h2 className="section-title">
      <span>Do more</span>
      <small>Everything else in your workspace</small>
    </h2>
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
      <Link href="/training" className="tile-card">
        <span className="tile-icon t-sage"><IconBook size={19} /></span>
        <b>Training centre</b>
        <small>Short practice modules for busy school days.</small>
        <span className="tile-link">Explore <IconArrow size={12} /></span>
      </Link>
      <Link href="/community" className="tile-card">
        <span className="tile-icon t-clay"><IconUsers size={19} /></span>
        <b>Teacher community</b>
        <small>Practical classroom ideas shared by peers.</small>
        <span className="tile-link">Join the circle <IconArrow size={12} /></span>
      </Link>
      <Link href="/updates" className="tile-card">
        <span className="tile-icon t-honey"><IconClock size={19} /></span>
        <b>Verified updates</b>
        <small>Official resources and policy links, sourced.</small>
        <span className="tile-link">Browse <IconArrow size={12} /></span>
      </Link>
      <Link href="/resources" className="tile-card">
        <span className="tile-icon t-green"><IconFolder size={19} /></span>
        <b>My resources</b>
        <small>Saved plans ready to reuse and export.</small>
        <span className="tile-link">Open library <IconArrow size={12} /></span>
      </Link>
    </div>

    {/* ── Multi-grade primer ────────────────────────────────────── */}
    <div className="guide-banner">
      <div>
        <span className="new-flag">The multi-grade difference</span>
        <h2>One room, many grades — one coordinated plan.</h2>
        <p>
          THRIVE's compiler plans a shared opening, a teacher-led turn for each grade, and independent
          tasks for waiting groups — filling your exact minutes. Impossible schedules are rejected with
          explicit reasons, never faked.
        </p>
      </div>
      <Link href="/compiler" className="btn btn-primary"><IconLayers size={14} /> Plan a period</Link>
    </div>
  </Layout>
}
