import {useEffect,useState} from 'react'
import Layout from '../components/Layout'
import {useStoredState} from '../lib/storage'
import {api,getToken} from '../lib/api'
import {fetchPlans,mergePlans,normalizePlan,savePlan} from '../lib/plans'
import Link from 'next/link'
import {IconSearch} from '../components/Icons'

export default function Resources(){
 const [plans,setPlans]=useStoredState<any[]>('plans',[])
 const [filter,setFilter]=useState('All'),[busy,setBusy]=useState(false)
 const [query,setQuery]=useState('')

 // Server plans are the source of truth when signed in (guest session too);
 // merge over the local mirror through the shared normalizer.
 useEffect(()=>{
  ;(async()=>{
   const rows=await fetchPlans()
   if(rows.length) setPlans(mergePlans(plans,rows))
  })()
 },[])

 async function remove(id:any){
  if(!confirm('Delete this saved lesson plan?'))return
  setPlans(plans.filter(p=>p.id!==id))
  if(getToken()&&typeof id==='number'&&id<1000000000000){try{await api.delete(`/api/plans/${id}`)}catch{}}
 }

 // Open in Curriculum Studio: the studio hydrates itself from ?open=<id>.
 function openPlan(p:any){
  sessionStorage.setItem('thrive:openPlan',JSON.stringify(p))
  window.location.href=`/compiler?open=${encodeURIComponent(String(p.id))}`
 }

 // Duplicate = save an identical copy under a new title (and a new server row).
 async function duplicate(p:any){
  const item=normalizePlan({...p,title:`${p.title||'Lesson plan'} (copy)`,savedAt:new Date().toISOString()})
  if(!item)return
  const saved=await savePlan(item)
  setPlans([saved,...plans.filter(x=>x.id!==saved.id)])
  toast('Duplicated — a copy is in your saved plans')
 }

 function toast(t:string){ setBusy(false); const el=document.createElement('div'); el.className='toast'; el.setAttribute('aria-live', 'polite'); el.textContent=t;
  document.body.appendChild(el); setTimeout(()=>{el.remove()},2600) }

 function download(p:any){
  const blob=new Blob([JSON.stringify(p,null,2)],{type:'application/json'})
  const a=document.createElement('a');a.href=URL.createObjectURL(blob)
  a.download=`${(p.title||'thrive-plan').toLowerCase().replace(/[^a-z0-9]+/g,'-')}.json`
  a.click();URL.revokeObjectURL(a.href)
 }

 const items=plans.filter(p=>(filter==='All'||p.subject===filter)&&
  `${p.title||''} ${p.subject||''} ${(p.grades||[]).map((g:any)=>`${g.grade} ${g.topic}`).join(' ')}`
   .toLowerCase().includes(query.trim().toLowerCase()))
 const subjects=['All',...Array.from(new Set(plans.map(p=>p.subject).filter(Boolean))) as string[]]

 return <Layout title="My resources">
  <div className="page-heading"><div><div className="eyebrow">My resources</div><h1>Your classroom work, ready to reuse.</h1><p>Saved lesson plans, exported for your classroom{getToken()?' and synced to your account':''}.</p></div>
   <a className="btn btn-primary" href="/compiler">＋ Create a plan</a></div>
  <section className="panel">
   <div className="spread" style={{marginBottom:12,flexWrap:'wrap',gap:9}}>
    <div className="pill-tabs" style={{margin:0}}>{subjects.map(s=><button key={s} className={filter===s?'selected':''} onClick={()=>setFilter(s)}>{s}</button>)}</div>
    <div className="row" style={{gap:9,marginLeft:'auto'}}>
     <div className="search-box" style={{width:210}}>
      <IconSearch/>
      <input className="input" placeholder="Search saved plans…" value={query} onChange={e=>setQuery(e.target.value)}/>
     </div>
     <span className="muted" style={{fontSize:9,whiteSpace:'nowrap'}}>{items.length} saved{busy?' · syncing…':''}</span>
    </div>
   </div>
   {items.length?items.map(p=><div className="resource-row" key={p.id}>
    <div><div className="resource-name">{p.title||'Lesson plan'}</div>
     <small>{p.grades?.length?p.grades.map((g:any)=>`Grade ${g.grade}${g.topic?`: ${g.topic}`:''}`).join(' · '):p.draft?'Assistant draft':'Classroom plan'}</small></div>
    <span>{p.subject||'Teaching plan'}<small>{p.minutes||40} minutes</small></span>
    <span className="muted">{p.savedAt?new Date(p.savedAt).toLocaleDateString():'Saved'}</span>
    <div className="row">
     <button className="btn btn-small" onClick={()=>openPlan(p)} aria-label="Open in Curriculum Studio">Open</button>
     <button className="btn btn-small" onClick={()=>duplicate(p)} aria-label="Duplicate">Copy</button>
     <button className="btn btn-small" onClick={()=>download(p)} aria-label="Download">↓</button>
     <button className="btn btn-small" onClick={()=>remove(p.id)} aria-label="Delete">×</button></div>
   </div>):<div className="empty">{query||filter!=='All'
    ?<>No saved plans match this search. Clear the search or choose <b>All</b> to see everything.</>
    :<>No saved resources yet. Generate a classroom schedule and select <b>Save plan</b> to keep it here.
      <Link href="/compiler" className="btn btn-primary btn-small" style={{marginTop:12}}>Create a plan</Link></>}</div>}
  </section>
  <div className="notice" style={{marginTop:14}}>{getToken()
   ?'Plans are stored in your THRIVE account and mirrored on this device for offline access.'
   :'Plans are stored in this browser. Sign in from My profile to sync them to your account.'}</div>
 </Layout>
}
