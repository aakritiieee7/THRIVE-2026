import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import { getToken } from '../lib/api'
import { useStoredState } from '../lib/storage'
import { backendUp } from '../lib/api'
import { seedCourses } from '../lib/storage'
import {
  IconArrow, IconBook, IconChat, IconClock, IconFolder, IconLayers,
  IconPlus, IconSparkle, IconStudio, IconUsers, IconWand, IconClipboard,
} from '../components/Icons'

const fmt = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`

export default function Home() {
  const router = useRouter()
  const [plans] = useStoredState<any[]>('plans', [])
  const [profile] = useStoredState<any>('profile', { name: '', grades: '', subjects: '', state: 'Bihar', board: 'Bihar SCERT', medium: 'Hindi + English' })
  const [progress] = useStoredState<Record<string, number>>('training-progress', {})
  const [greeting, setGreeting] = useState('Good morning')
  const [day, setDay] = useState('')
  const [status, setStatus] = useState<'checking' | 'online' | 'local'>('checking')

  // Public visitors get the landing page; teachers keep the workspace.
  useEffect(() => {
    if (!getToken()) router.replace('/landing')
  }, [router])

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
    setDay(new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }))
    backendUp().then((ok) => setStatus(ok ? 'online' : 'local'))
  }, [])

  const firstName = (profile.name || '').trim().split(/\s+/)[0] || 'Teacher'
  const lessonsDone = Object.values(progress).reduce((a, b) => a + b, 0)
  const lessonsTotal = seedCourses.reduce((a, c) => a + c.lesson.length, 0)
  const activeCourse = seedCourses.find(c => (progress[c.id] || 0) > 0 && (progress[c.id] || 0) < c.lesson.length)
  const gradeList = (profile.grades || '').split(',').map((g: string) => g.trim()).filter(Boolean)

  return <Layout title="Home">
    {/* ── Greeting band: the workspace's front door ─────────────── */}
    <div className="greet-band">
      <div className="date-line">
        {day || 'Today'}
        <span aria-hidden="true">·</span>
        {status === 'checking' ? 'checking your workspace…' : status === 'online' ? 'workspace online' : 'saved on this device'}
      </div>
      <h1>{greeting}, {firstName}.</h1>
      <p>Plan one coordinated period across every grade in your room — or pick up where you left off.</p>
      <div className="greet-actions">
        <Link href="/compiler" className="btn btn-sun"><IconPlus size={14} /> Create a lesson plan</Link>
        <Link href="/assistant" className="btn"><IconChat size={14} /> Ask the teaching assistant</Link>
      </div>
    </div>

    {/* ── Primary shortcuts ─────────────────────────────────────── */}
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', marginBottom: 4 }}>
      <Link href="/compiler" className="tile-card">
        <span className="tile-icon t-green"><IconStudio size={19} /></span>
        <b>Curriculum Studio</b>
        <small>Constraint-checked multi-grade schedules, grounded in seeded curriculum structure.</small>
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
            <div><h2>Keep learning</h2><p>{lessonsDone} of {lessonsTotal} lessons done</p></div>
            <Link href="/training" className="text-link">Training</Link>
          </div>
          <div className="progress-line"><i style={{ width: `${Math.min(100, Math.round(lessonsDone / lessonsTotal * 100))}%` }} /></div>
          {activeCourse
            ? <Link href="/training" className="plan-item" style={{ marginTop: 12 }}>
              <span className="plan-icon"><IconBook size={15} /></span>
              <span><b>{activeCourse.title}</b>
                <small>{progress[activeCourse.id]} / {activeCourse.lesson.length} lessons · continue</small></span>
              <span className="right"><IconArrow size={14} /></span>
            </Link>
            : <div className="muted" style={{ fontSize: 11, marginTop: 11, lineHeight: 1.6 }}>
              No course in progress. {seedCourses.length} short courses are waiting in the Training centre.
            </div>}
        </section>

        {/* Teaching context */}
        <section className="panel">
          <div className="panel-title">
            <div><h2>Your teaching context</h2><p>Used to tailor suggestions</p></div>
            <Link href="/profile" className="text-link">Edit</Link>
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 7 }}>
            <span className="tag tag-green">{profile.state} · {profile.board}</span>
            <span className="tag">{profile.medium}</span>
            {gradeList.length > 0 && <span className="tag tag-honey">Grades {gradeList.join(', ')}</span>}
            {profile.subjects && <span className="tag">{profile.subjects}</span>}
          </div>
          <p className="muted" style={{ fontSize: 10.5, lineHeight: 1.6, marginTop: 12 }}>
            Seeded coverage: NCERT-aligned Grades 1–5 (Mathematics, EVS). Bihar SCERT content is not yet ingested —
            confirm against your official syllabus.
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
