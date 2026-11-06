import {useEffect,useState} from 'react'
import Layout from '../components/Layout'
import {useStoredState} from '../lib/storage'
import {api,getToken} from '../lib/api'

export default function Resources(){
 const [plans,setPlans]=useStoredState<any[]>('plans',[])
 const [filter,setFilter]=useState('All'),[busy,setBusy]=useState(false)

 // Server plans are the source of truth when signed in; merge with local.
 useEffect(()=>{
  if(!getToken())return
  ;(async()=>{
   try{
    const rows=await api.get<any[]>('/api/plans')
    if(Array.isArray(rows)&&rows.length){
     const mapped=rows.map(r=>({id:r.id,title:r.title,subject:r.subject,medium:r.medium,board:r.board,minutes:r.minutes,
      grades:r.payload?.grades||[],schedule:r.payload?.schedule||[],assessments:r.payload?.assessments||[],
      savedAt:r.created_at,server:true}))
     const ids=new Set(mapped.map(m=>m.id))
     setPlans([...mapped,...plans.filter(p=>!ids.has(p.id))])
    }
   }catch{}
  })()
 },[])

 async function remove(id:number){
  if(!confirm('Delete this saved lesson plan?'))return
  setPlans(plans.filter(p=>p.id!==id))
  if(getToken()&&typeof id==='number'&&id<1000000000000){try{await api.delete(`/api/plans/${id}`)}catch{}}
 }

 function download(p:any){
  const blob=new Blob([JSON.stringify(p,null,2)],{type:'application/json'})
  const a=document.createElement('a');a.href=URL.createObjectURL(blob)
  a.download=`${(p.title||'thrive-plan').toLowerCase().replace(/[^a-z0-9]+/g,'-')}.json`
  a.click();URL.revokeObjectURL(a.href)
 }

 const items=plans.filter(p=>filter==='All'||p.subject===filter)
 const subjects=['All',...Array.from(new Set(plans.map(p=>p.subject).filter(Boolean))) as string[]]

 return <Layout title="My resources">
  <div className="page-heading"><div><div className="eyebrow">MY RESOURCES</div><h1>Your classroom work, ready to reuse.</h1><p>Saved lesson plans, exported for your classroom{getToken()?' and synced to your account':''}.</p></div>
   <a className="btn btn-primary" href="/compiler">＋ Create a plan</a></div>
  <section className="panel">
   <div className="spread" style={{marginBottom:12}}>
    <div className="pill-tabs" style={{margin:0}}>{subjects.map(s=><button key={s} className={filter===s?'selected':''} onClick={()=>setFilter(s)}>{s}</button>)}</div>
    <span className="muted" style={{fontSize:9}}>{items.length} saved{busy?' · syncing…':''}</span>
   </div>
   {items.length?items.map(p=><div className="resource-row" key={p.id}>
    <div><div className="resource-name">{p.title||'Lesson plan'}</div>
     <small>{p.grades?.length?p.grades.map((g:any)=>`Grade ${g.grade}: ${g.topic}`).join(' · '):'Classroom plan'}</small></div>
    <span>{p.subject||'Teaching plan'}<small>{p.minutes||40} minutes</small></span>
    <span className="muted">{p.savedAt?new Date(p.savedAt).toLocaleDateString():'Saved'}</span>
    <div className="row"><button className="btn btn-small" onClick={()=>download(p)} aria-label="Download">↓</button>
     <button className="btn btn-small" onClick={()=>remove(p.id)} aria-label="Delete">×</button></div>
   </div>):<div className="empty">No saved resources yet. Generate a classroom schedule and select <b>Save plan</b> to keep it here.</div>}
  </section>
  <div className="notice" style={{marginTop:14}}>{getToken()
   ?'Plans are stored in your THRIVE account and mirrored on this device for offline access.'
   :'Plans are stored in this browser. Sign in from My profile to sync them to your account.'}</div>
 </Layout>
}
