import Head from 'next/head'
import Link from 'next/link'
import { ThriveLogo } from '../components/Logo'
import {
  IllHero, IllMath, IllEVS, IllLanguage, IllScience,
  IllResources, IllTraining, IllCommunity,
} from '../components/Illustrations'
import { IconArrow, IconChat, IconUsers } from '../components/Icons'

/**
 * Public landing page — the marketing front door, separate from the
 * workspace dashboard (which lives at "/"). Two clear paths: try THRIVE
 * as a guest, or log in as a registered teacher.
 */

const PILLARS = [
  {
    ill: <IllMath size={92} />, title: 'AI teaching assistant',
    body: 'Ask in plain Hindi or English — about activities, concepts, or a classroom problem. Every reply shows its sources.',
    href: '/try', cta: 'Try the assistant',
  },
  {
    ill: <IllEVS size={92} />, title: 'Multigrade lesson planning',
    body: 'One classroom, many grades. Get a time-bound schedule with a shared opening, teacher turns, and independent tasks for waiting groups.',
    href: '/compiler', cta: 'Open Curriculum Studio',
  },
  {
    ill: <IllResources size={92} />, title: 'Teaching resources',
    body: 'Save lesson plans you generate, find them again, and reuse them. Everything is stored in your account.',
    href: '/resources', cta: 'See resources',
  },
  {
    ill: <IllTraining size={92} />, title: 'Teacher development',
    body: 'Short, practical training modules you can finish between periods, plus a community of peers facing the same rooms.',
    href: '/training', cta: 'Visit training centre',
  },
]

const REAL_CLASSROOM = [
  { ill: <IllLanguage size={64} />, title: 'Limited teaching time', body: 'A 40-minute period has to carry every grade in the room. THRIVE fills your exact minutes — or tells you why it cannot.' },
  { ill: <IllScience size={64} />, title: 'Low-cost materials', body: 'Activities are written for chalk, paper, and objects already in the room — no new purchases assumed.' },
  { ill: <IllCommunity size={64} />, title: 'Curriculum alignment', body: 'Grounded in seeded NCERT-aligned Grades 1–5 (Mathematics, EVS). Bihar SCERT is not yet ingested — confirm against your syllabus.' },
]

/** Static WhatsApp conversation mock — labelled as a preview, not a live bot. */
const WA_THREAD = [
  { from: 'teacher', text: 'Grade 2, 3 and 4 in one classroom. I have 40 minutes to teach mathematics. What should I do?' },
  { from: 'thrive', text: 'Here is a 40-minute plan for Grades 2, 3, 4:\n\n00:00–00:05 Whole-class opening\n00:05–00:15 Teacher turn · Grade 2 (Grades 3, 4 do the when-you-finish task)\n00:15–00:25 Teacher turn · Grade 3\n00:25–00:34 Teacher turn · Grade 4\n00:34–00:40 Closing check — one prompt per grade\n\nWant this as a worksheet?' },
]

export default function Landing() {
  return (
    <div className="landing">
      <Head>
        <title>THRIVE — Teacher Support, Together.</title>
        <meta name="description" content="AI teaching assistant, multigrade lesson planning, resources and training for teachers in real classrooms." />
      </Head>

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="landing-top">
        <Link href="/" className="brand" aria-label="THRIVE home">
          <ThriveLogo size={34} />
        </Link>
        <nav aria-label="Landing">
          <a href="#how">How it helps</a>
          <a href="#whatsapp">WhatsApp</a>
          <a href="#classrooms">For real classrooms</a>
        </nav>
        <div className="landing-actions">
          <Link href="/login" className="btn">Teacher login</Link>
          <Link href="/try" className="btn btn-primary">Try THRIVE</Link>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Teacher Support, Together.</span>
          <h1>Plan a multi-grade period in the minutes before class starts.</h1>
          <p>
            THRIVE is an AI teaching companion for classrooms with many grades and few resources —
            ask a question, generate a time-bound lesson plan, and keep your resources in one place.
          </p>
          <div className="hero-cta">
            <Link href="/try" className="btn btn-sun"><IconChat size={15} /> Try THRIVE — no account needed</Link>
            <Link href="/login" className="btn btn-primary">Teacher login <IconArrow size={13} /></Link>
          </div>
          <small className="hero-note">
            Guests get free assistant questions and lesson-plan drafts per session. An account keeps
            your plans, history and progress.
          </small>
        </div>
        <div className="hero-art" aria-hidden="true">
          <IllHero size={460} />
        </div>
      </section>

      {/* ── Four pillars ────────────────────────────────────────── */}
      <section className="landing-section" id="how">
        <div className="section-head">
          <span className="eyebrow">How THRIVE helps</span>
          <h2>Four things, done properly.</h2>
        </div>
        <div className="pillar-grid">
          {PILLARS.map((p) => (
            <article className="pillar-card" key={p.title}>
              <div className="pillar-art">{p.ill}</div>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
              <Link href={p.href} className="text-link">{p.cta} <IconArrow size={12} /></Link>
            </article>
          ))}
        </div>
      </section>

      {/* ── WhatsApp ────────────────────────────────────────────── */}
      <section className="landing-section wa-section" id="whatsapp">
        <div className="wa-copy">
          <span className="eyebrow">Multichannel</span>
          <h2>Ask THRIVE from WhatsApp.</h2>
          <p>
            Teachers who live on WhatsApp should not have to open a website. Message THRIVE with a
            lesson question and get a grounded answer with sources — in Hindi or English.
          </p>
          <div className="wa-status-note">
            <b>Integration status:</b> the chatbot backend and webhook are built and tested. Sending
            real messages needs a verified Meta WhatsApp Business number and credentials (see README).
            Until then the interface runs in <b>local simulation</b> — replies are generated by the
            same assistant, but nothing reaches a real phone.
          </div>
          <Link href="/try" className="btn btn-primary">Open the chat preview <IconArrow size={13} /></Link>
        </div>
        <div className="wa-mock" role="img" aria-label="Example WhatsApp conversation with THRIVE">
          <div className="wa-mock-head">
            <span className="wa-avatar"><ThriveLogo variant="icon" size={22} /></span>
            <span><b>THRIVE Assistant</b><small>online · replies in Hindi & English</small></span>
          </div>
          {WA_THREAD.map((m, i) => (
            <div key={i} className={`wa-line ${m.from === 'teacher' ? 'mine' : ''}`}>
              <div className="wa-bubble" style={{ whiteSpace: 'pre-line' }}>{m.text}</div>
            </div>
          ))}
          <div className="wa-mock-foot">Preview of the conversation — not a live session</div>
        </div>
      </section>

      {/* ── Real classrooms ─────────────────────────────────────── */}
      <section className="landing-section" id="classrooms">
        <div className="section-head">
          <span className="eyebrow">Designed for real classrooms</span>
          <h2>Built around the constraints you actually have.</h2>
        </div>
        <div className="pillar-grid three">
          {REAL_CLASSROOM.map((r) => (
            <article className="pillar-card flat" key={r.title}>
              {r.ill}
              <h3>{r.title}</h3>
              <p>{r.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="landing-cta">
        <h2>Start with one period.</h2>
        <p>Try THRIVE as a guest, or create an account to keep your plans and progress.</p>
        <div className="hero-cta">
          <Link href="/try" className="btn btn-sun">Try THRIVE</Link>
          <Link href="/signup" className="btn btn-primary">Create a teacher account <IconArrow size={13} /></Link>
        </div>
      </section>

      <footer className="landing-foot">
        <ThriveLogo size={30} />
        <span>Curriculum seed: NCERT-aligned Grades 1–5 (Mathematics, EVS). Review against your official syllabus.</span>
      </footer>
    </div>
  )
}
