import {useEffect,useMemo,useState} from 'react'
import Layout from '../components/Layout'
import {seedUpdates,useStoredState} from '../lib/storage'
import {api,getToken} from '../lib/api'

export default function Updates(){
 const [saved,setSaved]=useStoredState<string[]>('bookmarked-updates',[])
 const [profile]=useStoredState<any>('profile',{grades:'',subjects:''})
 const [query,setQuery]=useState(''),[category,setCategory]=useState('All')
 const cats=['All','Training','Policy','Resources']

 // Relevance is derived only from the teacher's own saved profile — no invented scores.
 const relevance=useMemo(()=>{
  const bits:string[]=[]
  const grades=(profile.grades||'').trim()
  const subjects=(profile.subjects||'').trim()
  if(grades)bits.push(`Grades ${grades}`)
  if(subjects)bits.push(subjects)
  return bits
 },[profile.grades,profile.subjects])

 // Rank matched items first; relevance is a match against your profile, not a popularity claim.
 const items=useMemo(()=>{
  const q=query.toLowerCase()
  const matched=(x:any)=>{
   const hay=`${x.title} ${x.org} ${x.summary}`.toLowerCase()
   if(!hay.includes(q))return false
   if(!relevance.length)return true
   return relevance.some(r=>hay.includes(r.toLowerCase().split(' ')[0]))||
     /literacy|numeracy|multi-grade|inclusive|classroom|foundational/i.test(hay)
  }
  const passes=(x:any)=>(category==='All'||x.category===category)&&`${x.title} ${x.org} ${x.summary}`.toLowerCase().includes(q)
  const pool=seedUpdates.filter(passes)
  return [...pool.filter(matched),...pool.filter(x=>!matched(x))]
 },[category,query,relevance])

 // Sync bookmarks to the account when signed in (local copy always works).
 useEffect(()=>{
  if(!getToken())return
  ;(async()=>{
   try{
    const r=await api.get<{item_ids:string[]}>('/api/updates/bookmarks')
    if(r?.item_ids?.length)setSaved(Array.from(new Set([...saved,...r.item_ids])))
   }catch{}
  })()
 },[])

 async function toggle(id:string){
  const on=saved.includes(id)
  const next=on?saved.filter(x=>x!==id):[...saved,id]
  setSaved(next)
  if(getToken()){
   try{
    if(on)await api.delete(`/api/updates/bookmarks/${id}`)
    else await api.put(`/api/updates/bookmarks/${id}`)
   }catch{}
  }
 }

 return <Layout title="Updates">
  <div className="page-heading"><div><div className="eyebrow">Verified education information</div><h1>Useful updates, with the source attached.</h1><p>Curated official education resources and policy links. Always confirm dates and applicability at the source.</p></div></div>
  <div className="notice" style={{marginBottom:14}}>This collection contains stable official resources and policy links; it does not ingest live circulars. No fabricated updates are shown — every item links to its issuing organisation.</div>
  {relevance.length>0
   ?<div className="muted" style={{fontSize:10,marginBottom:12,lineHeight:1.7}}>Matched to your profile ({relevance.join(' · ')}): items relevant to your grades and subjects are listed first. Ordering reflects a match with your saved profile only — it is not a popularity or impact score.</div>
   :<div className="muted" style={{fontSize:10,marginBottom:12,lineHeight:1.7}}>Set your grades and subjects in Guided setup or My profile to see which updates match your teaching context. Nothing is ranked by popularity.</div>}
  <section className="panel">
   <div className="spread" style={{marginBottom:14}}>
    <div className="pill-tabs" style={{margin:0}}>{cats.map(c=><button className={category===c?'selected':''} key={c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
    <input className="input" style={{maxWidth:235}} placeholder="Search title or organisation" value={query} onChange={e=>setQuery(e.target.value)}/>
   </div>
   <div className="grid update-grid">
    {items.map((item,i)=>{const isMatch=i<items.length&&relevance.length>0&&(()=>{
      const hay=`${item.title} ${item.org} ${item.summary}`.toLowerCase()
      return relevance.some(r=>hay.includes(r.toLowerCase().split(' ')[0]))||
        /literacy|numeracy|multi-grade|inclusive|classroom|foundational/i.test(hay)
     })();return <article className="panel update-card" key={item.id}>
     <div className="spread"><span className="tag">{item.category}</span>
      <span className="row" style={{gap:7}}>
       {isMatch&&<span className="tag" style={{background:'#e5efe8',color:'var(--forest-deep)'}} title="Matches the grades or subjects in your saved profile">Matches your profile</span>}
       <button className="btn btn-small" aria-label="Bookmark update" onClick={()=>toggle(item.id)}>{saved.includes(item.id)?'★ Saved':'☆ Save'}</button>
      </span></div>
     <h3>{item.title}</h3><p>{item.summary}</p>
     <div className="source-line"><span>{item.org}</span><span>{item.date}</span></div>
     <a className="text-link" style={{display:'inline-block',marginTop:12}} href={item.url} target="_blank" rel="noreferrer">Open original source ↗</a>
    </article>})}
   </div>
   {items.length===0&&<div className="empty">No updates match your search.</div>}
  </section>
  <div className="panel" style={{marginTop:14}}>
   <div className="panel-title"><div><h2>Saved updates</h2><p>{getToken()?'Synced to your account':'Bookmarks stay on this device'}</p></div></div>
   {saved.length?<div className="row" style={{flexWrap:'wrap'}}>{saved.map(id=>{const item=seedUpdates.find(x=>x.id===id);return item?<span className="tag" key={id}>{item.title}</span>:null})}</div>:<div className="muted" style={{fontSize:10}}>Save an item above to find it again here.</div>}
  </div>
 </Layout>
}
