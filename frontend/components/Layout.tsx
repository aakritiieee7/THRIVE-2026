import Link from 'next/link'
import { useRouter } from 'next/router'
import React from 'react'

const nav = [
  ['/', '⌂', 'Home'], ['/compiler', '▦', 'Curriculum Studio'], ['/assistant', '✳', 'Teaching assistant'],
  ['/training', '▤', 'Training centre'], ['/updates', '◷', 'Updates'], ['/community', '◎', 'Teacher community'], ['/resources', '▣', 'My resources'],
]

export default function Layout({children, title}:{children:React.ReactNode;title?:string}) {
  const router = useRouter()
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-mark">t</span><span><b>THRIVE</b><small>Teacher support, together</small></span></Link>
      <div className="side-label">WORKSPACE</div>
      <nav>{nav.map(([href,icon,label])=><Link key={href} href={href} className={'nav-item '+(router.pathname===href?'active':'')}><span className="nav-icon">{icon}</span>{label}{href==='/compiler'&&<span className="nav-new">CORE</span>}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="offline"><span className="online-dot"/>Your workspace is saved on this device</div><Link className="teacher-card" href="/profile"><span className="avatar">A</span><span><b>Aarohi Sharma</b><small>Primary teacher · Bihar</small></span><span className="more">···</span></Link></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><b>{title || nav.find(x=>x[0]===router.pathname)?.[2]}</b></div><div className="top-actions"><button className="icon-button" aria-label="Notifications">♧<i/></button><Link href="/profile" className="top-avatar">A</Link></div></header><div className="page-content">{children}</div><footer className="app-footer">THRIVE · Teacher Hub for Resources, Instruction, Verified Information &amp; Empowerment <span>Helping teachers thrive, helping students flourish.</span></footer></main>
    <nav className="mobile-nav">{nav.slice(0,5).map(([href,icon,label])=><Link href={href} key={href} className={router.pathname===href?'active':''}><span>{icon}</span>{label==='Curriculum Studio'?'Plan':label==='Teaching assistant'?'Ask':label}</Link>)}</nav>
  </div>
}
