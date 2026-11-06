import Link from 'next/link'
import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useStoredState } from '../lib/storage'
import { getToken, backendUp } from '../lib/api'

export default function Home() {
  const [plans] = useStoredState<any[]>('plans', [])
  const [profile] = useStoredState<any>('profile', { name: 'Teacher', grades: '', subjects: '', state: 'Bihar', board: 'Bihar SCERT', medium: 'Hindi + English' })
  const [greeting, setGreeting] = useState('Good morning')
  const [day, setDay] = useState('')
  const [status, setStatus] = useState<'checking' | 'online' | 'local'>('checking')

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
    setDay(new Date().toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase())
    backendUp().then((ok) => setStatus(ok ? 'online' : 'local'))
  }, [])

  const firstName = (profile.name || 'Teacher').trim().split(/\s+/)[0]
  const quick = [
    ['▦', 'Plan a multi-grade lesson', 'Build one coordinated, constraint-checked schedule across grade groups.', '/compiler'],
    ['✳', 'Ask the teaching assistant', 'Ground-level answers with sources, shaped by your classroom context.', '/assistant'],
    ['▤', 'Continue learning', 'Short professional-development modules with persistent progress.', '/training'],
    ['◎', 'Learn with other teachers', 'Practical classroom ideas shared by peers.', '/community'],
  ]

  return <Layout title="Home">
    <div className="page-heading">
      <div><div className="eyebrow">{day || 'TODAY'} · YOUR TEACHER WORKSPACE</div></div>
      <Link className="btn" href="/profile">⚙ &nbsp;My profile</Link>
    </div>
    <section className="welcome">
      <div className="welcome-copy">
        <div className="date-line">
          Your classroom, supported
          <span style={{ marginLeft: 10 }}>
            {status === 'checking' ? '· checking services…' : status === 'online' ? '· backend connected' : '· local mode'}
          </span>
        </div>
        <h1>{greeting}, {firstName} <span style={{ color: '#d28b55' }}>✦</span></h1>
        <p>Small, thoughtful steps make a meaningful difference in every classroom.</p>
        <Link href="/compiler" className="btn btn-primary">Plan today's lesson <span>→</span></Link>
      </div>
      <div className="welcome-graphic">✿</div>
    </section>
    <div className="grid quick-grid">
      {quick.map(([icon, title, desc, href]) =>
        <Link className="quick-card" href={href} key={title}>
          <span className="quick-icon">{icon}</span><b>{title}</b><small>{desc}</small>
        </Link>)}
    </div>
    <div className="grid dashboard-grid">
      <section className="panel">
        <div className="panel-title"><div><h2>Your saved lesson plans</h2><p>Pick up where you left off</p></div><Link href="/resources" className="text-link">All resources →</Link></div>
        {plans.length
          ? <div className="plan-list">{plans.slice(0, 4).map((p: any) =>
            <div className="plan-item" key={p.id}>
              <span className="plan-icon">▦</span>
              <span><b>{p.title || 'Multi-grade lesson plan'}</b>
                <small>{p.grades?.map((g: any) => `Grade ${g.grade}`).join(' · ') || 'Classroom plan'} · {p.minutes || 40} min</small></span>
              <span className="right"><small>{p.savedAt ? 'Saved' : 'Draft'}</small></span>
            </div>)}
          </div>
          : <div className="empty">Your lesson plans will appear here after you save them.<br />
            <Link href="/compiler" className="text-link" style={{ display: 'inline-block', marginTop: 10 }}>Create your first plan →</Link>
          </div>}
      </section>
      <section className="panel">
        <div className="panel-title"><div><h2>A little learning, often</h2><p>Short practice for busy school days</p></div><Link href="/training" className="text-link">Explore →</Link></div>
        <div style={{ padding: '7px 0 12px' }}>
          <span className="tag">SUGGESTED FOR YOU</span>
          <h3 style={{ font: '700 13px Manrope', margin: '12px 0 6px' }}>Teaching in a multi-grade classroom</h3>
          <p className="muted" style={{ fontSize: 10, lineHeight: 1.6, margin: '0 0 14px' }}>A practical 35-minute course on organizing teacher-led time and independent activities.</p>
          <Link className="btn btn-small" href="/training">Open course →</Link>
        </div>
      </section>
    </div>
    <div className="grid dashboard-grid" style={{ marginTop: 14 }}>
      <section className="panel">
        <div className="panel-title"><div><h2>From trusted sources</h2><p>Useful learning links and official information</p></div><Link href="/updates" className="text-link">Browse updates →</Link></div>
        <div className="plan-list">
          <div className="plan-item"><span className="plan-icon">↗</span><span><b>NISHTHA learning programmes</b><small>DIKSHA · Teacher professional development</small></span><a className="text-link" href="https://diksha.gov.in/" target="_blank" rel="noreferrer">Visit ↗</a></div>
          <div className="plan-item"><span className="plan-icon">↗</span><span><b>NCERT ePathshala</b><small>NCERT · Textbooks and learning resources</small></span><a className="text-link" href="https://epathshala.nic.in/" target="_blank" rel="noreferrer">Visit ↗</a></div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-title"><div><h2>Your teaching context</h2><p>Used to tailor suggestions</p></div><Link href="/profile" className="text-link">Edit →</Link></div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 7 }}>
          <span className="tag">{profile.state} · {profile.board}</span>
          <span className="tag">{profile.medium}</span>
          {profile.grades && <span className="tag">Grades {profile.grades}</span>}
          {profile.subjects && <span className="tag">{profile.subjects}</span>}
        </div>
        <p className="muted" style={{ fontSize: 9, lineHeight: 1.5, marginTop: 13 }}>Curriculum seed covers Grades 1–5 core chapters (NCERT-aligned). Confirm your state syllabus before classroom use.</p>
      </section>
    </div>
  </Layout>
}
