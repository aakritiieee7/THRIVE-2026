import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getToken } from '../lib/api'
import { useStoredState } from '../lib/storage'

const nav = [
  ['/', '⌂', 'Home'], ['/compiler', '▦', 'Curriculum Studio'], ['/assistant', '✳', 'Teaching assistant'],
  ['/training', '▤', 'Training centre'], ['/updates', '◷', 'Updates'], ['/community', '◎', 'Teacher community'], ['/resources', '▣', 'My resources'],
]

export default function Layout({ children, title }: { children: React.ReactNode; title?: string }) {
  const router = useRouter()
  const [signedIn, setSignedIn] = useState(false)
  const [profile] = useStoredState<any>('profile', { name: '', state: 'Bihar' })

  useEffect(() => { setSignedIn(!!getToken()) }, [router.pathname])

  const initials = (profile.name || 'Teacher').trim()
  const short = initials.split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-mark">t</span><span><b>THRIVE</b><small>Teacher support, together</small></span></Link>
      <div className="side-label">WORKSPACE</div>
      <nav>{nav.map(([href, icon, label]) =>
        <Link key={href} href={href} className={'nav-item ' + (router.pathname === href ? 'active' : '')}>
          <span className="nav-icon">{icon}</span>{label}{href === '/compiler' && <span className="nav-new">CORE</span>}
        </Link>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="offline">
          <span className="online-dot" />{signedIn ? 'Signed in · work syncs to your account' : 'Your workspace is saved on this device'}
        </div>
        <Link className="teacher-card" href="/profile">
          <span className="avatar">{short[0] || 'T'}</span>
          <span><b>{profile.name || 'Sign in'}</b><small>{signedIn ? 'THRIVE teacher account' : `${profile.state || 'Set'} your context`}</small></span>
          <span className="more">···</span>
        </Link>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><b>{title || nav.find(x => x[0] === router.pathname)?.[2]}</b></div>
        <div className="top-actions">
          <Link href="/updates" className="icon-button" aria-label="Updates">♧<i /></Link>
          <Link href="/profile" className="top-avatar">{short[0] || 'T'}</Link>
        </div>
      </header>
      <div className="page-content">{children}</div>
      <footer className="app-footer">
        THRIVE · Teacher Hub for Resources, Instruction, Verified Information &amp; Empowerment
        <span>Helping teachers thrive, helping students flourish.</span>
      </footer>
    </main>
    <nav className="mobile-nav">
      {nav.slice(0, 5).map(([href, icon, label]) =>
        <Link href={href} key={href} className={router.pathname === href ? 'active' : ''}>
          <span>{icon}</span>{label === 'Curriculum Studio' ? 'Plan' : label === 'Teaching assistant' ? 'Ask' : label}
        </Link>)}
    </nav>
  </div>
}
