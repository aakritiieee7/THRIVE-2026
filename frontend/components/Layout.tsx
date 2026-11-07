import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getToken } from '../lib/api'
import { useStoredState } from '../lib/storage'
import { IconBell, IconChat, IconFolder, IconHome, IconStudio, IconSparkle, IconBook, IconUsers, IconLayers } from './Icons'
import { ThriveLogo } from './Logo'

const nav = [
  { href: '/', icon: IconHome, label: 'Home' },
  { href: '/guided', icon: IconSparkle, label: 'Guided setup' },
  { href: '/compiler', icon: IconStudio, label: 'Curriculum Studio', badge: 'CORE' },
  { href: '/assistant', icon: IconChat, label: 'Teaching assistant' },
  { href: '/training', icon: IconBook, label: 'Training centre' },
  { href: '/updates', icon: IconBell, label: 'Verified updates' },
  { href: '/community', icon: IconUsers, label: 'Teacher community' },
  { href: '/resources', icon: IconFolder, label: 'My resources' },
]

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
  const [profile] = useStoredState<any>('profile', { name: '', state: 'Bihar' })

  useEffect(() => { setSignedIn(!!getToken()) }, [router.pathname])

  const name = (profile.name || '').trim()
  const short = name ? name.split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() : 'T'
  const current = nav.find(n => n.href === router.pathname)

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand">
        <Link href="/" className="brand-link"><ThriveLogo size={34} /></Link>
        <Link href="/landing" className="text-link" style={{ fontSize: 10, display: 'block', marginTop: 3 }}>About THRIVE</Link>
      </div>
      <div className="side-label">Workspace</div>
      <nav aria-label="Main">
        {nav.map(({ href, icon: Icon, label, badge }) =>
          <Link key={href} href={href}
            className={'nav-item ' + (router.pathname === href ? 'active' : '')}
            aria-current={router.pathname === href ? 'page' : undefined}>
            <span className="nav-icon"><Icon size={17} /></span>
            {label}
            {badge && <span className="nav-new">{badge}</span>}
          </Link>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="offline">
          <span className="online-dot" />
          {signedIn ? 'Signed in · work syncs to your account' : 'Your workspace is saved on this device'}
        </div>
        <Link className="teacher-card" href="/profile">
          <span className="avatar">{short[0]}</span>
          <span>
            <b>{profile.name || 'Sign in'}</b>
            <small>{signedIn ? 'THRIVE teacher account' : `${profile.state || 'Set'} your context`}</small>
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
        <span>Curriculum seed: NCERT-aligned Grades 1–5 (Mathematics, EVS). Review against your official syllabus.</span>
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
