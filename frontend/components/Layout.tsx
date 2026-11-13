import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { backendUp, getToken } from '../lib/api'
import { useStoredState, EMPTY_PROFILE } from '../lib/storage'
import { IconBell, IconChat, IconFolder, IconHome, IconStudio, IconSparkle, IconBook, IconUsers, IconLayers } from './Icons'
import { ThriveLogo } from './Logo'

// Sidebar information architecture: grouped around classroom work,
// professional development and teacher collaboration.
const navGroups = [
  {
    label: 'Classroom work',
    items: [
      { href: '/', icon: IconHome, label: 'Home' },
      { href: '/guided', icon: IconSparkle, label: 'Guided setup' },
      { href: '/compiler', icon: IconStudio, label: 'Curriculum Studio' },
      { href: '/assistant', icon: IconChat, label: 'Teaching assistant' },
    ],
  },
  {
    label: 'Professional development',
    items: [
      { href: '/training', icon: IconBook, label: 'Training centre' },
      { href: '/updates', icon: IconBell, label: 'Verified updates' },
    ],
  },
  {
    label: 'Teacher collaboration',
    items: [
      { href: '/community', icon: IconUsers, label: 'Teacher community' },
      { href: '/resources', icon: IconFolder, label: 'My resources' },
    ],
  },
]
const nav = navGroups.flatMap(g => g.items)

const mobileNav = [
  { href: '/', icon: IconHome, label: 'Home' },
  { href: '/compiler', icon: IconStudio, label: 'Plan' },
  { href: '/assistant', icon: IconChat, label: 'Ask' },
  { href: '/training', icon: IconBook, label: 'Learn' },
  { href: '/resources', icon: IconFolder, label: 'Saved' },
]

export default function Layout({ children, title }: { children: React.ReactNode; title?: string }) {
  const router = useRouter()
  const [signedIn, setSignedIn] = useState(false)
  const [online, setOnline] = useState<boolean | null>(null)
  const [profile] = useStoredState<any>('profile', EMPTY_PROFILE)

  useEffect(() => { setSignedIn(!!getToken()) }, [router.pathname])

  // The dot reflects whether the backend is actually reachable — it goes amber
  // (not a false green) when THRIVE is running from local device storage only.
  useEffect(() => {
    let alive = true
    backendUp().then(up => { if (alive) setOnline(up) })
    return () => { alive = false }
  }, [])

  const name = (profile.name || '').trim()
  const short = name ? name.split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() : 'T'
  const current = nav.find(n => n.href === router.pathname)

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand">
        <Link href="/" className="brand-link"><ThriveLogo size={34} /></Link>
        <Link href="/landing" className="text-link" style={{ fontSize: 10, display: 'block', marginTop: 3 }}>About THRIVE</Link>
      </div>
      <nav aria-label="Main">
        {navGroups.map(group =>
          <div key={group.label} className="nav-group">
            <div className="side-label">{group.label}</div>
            {group.items.map(({ href, icon: Icon, label }) =>
              <Link key={href} href={href}
                className={'nav-item ' + (router.pathname === href ? 'active' : '')}
                aria-current={router.pathname === href ? 'page' : undefined}>
                <span className="nav-icon"><Icon size={17} /></span>
                {label}
              </Link>)}
          </div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="offline">
          <span className="online-dot"
            style={online === false
              ? { background: 'var(--honey)' }
              : online === null ? { background: 'var(--faint)' } : undefined} />
          {online === false
            ? 'Offline · saving on this device'
            : signedIn ? 'Signed in · work syncs to your account' : 'Your workspace is saved on this device'}
        </div>
        <Link className="teacher-card" href="/profile">
          <span className="avatar">{short[0]}</span>
          <span>
            <b>{profile.name || 'Sign in'}</b>
            <small>{signedIn
              ? 'THRIVE teacher account'
              : (profile.state || profile.board
                ? [profile.state, profile.board].filter(Boolean).join(' · ')
                : 'Set your teaching context')}</small>
          </span>
          <span className="more">···</span>
        </Link>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="breadcrumbs">
          <span>Workspace</span><span className="crumb-slash">/</span>
          <b>{title || current?.label}</b>
        </div>
        <div className="top-actions">
          <Link href="/updates" className="icon-button" aria-label="Verified updates"><IconBell size={16} /><i /></Link>
          <Link href="/community" className="icon-button" aria-label="Teacher community"><IconUsers size={16} /></Link>
          <Link href="/profile" className="top-avatar" aria-label="My profile">{short[0]}</Link>
        </div>
      </header>
      <div className="page-content">{children}</div>
      <footer className="app-footer">
        THRIVE · Teacher Hub for Resources, Instruction, Verified Information &amp; Empowerment
        <span>Included curriculum: NCERT-aligned Grades 1–5 (Mathematics, EVS). Review against your official syllabus.</span>
      </footer>
    </main>

    <nav className="mobile-nav" aria-label="Primary">
      {mobileNav.map(({ href, icon: Icon, label }) =>
        <Link href={href} key={href} className={router.pathname === href ? 'active' : ''}>
          <Icon size={17} />{label}
        </Link>)}
    </nav>
  </div>
}
