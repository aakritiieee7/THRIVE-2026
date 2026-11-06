import {useEffect,useMemo,useState} from 'react'
import Layout from '../components/Layout'
import {useStoredState} from '../lib/storage'
import {api,getToken} from '../lib/api'

type Reply={id:number;name:string;body:string}
type Post={id:number;name:string;location:string;topic:string;title:string;body:string;date:string;likes:number;replies:Reply[];reports:number}

const starter:Post[]=[
 {id:100,name:'Meena Kumari',location:'Gaya, Bihar',topic:'Multi-grade',title:'A small routine that helped during maths time',
  body:'I write three “when you finish” tasks on the board before we start. While I am with one group, the others know what to pick up next. Picture cards and quick number drawings have worked well for my class.',
  date:'Community example',likes:4,replies:[{id:1,name:'Ritu S.',body:'The visible next step is helpful. I will try a drawing prompt.'}],reports:0},
 {id:101,name:'Farah Khan',location:'Patna, Bihar',topic:'Literacy',title:'Paired reading with a picture retell',
  body:'After a short shared reading, I pair learners and ask them to retell one part using a quick drawing. It gives quieter children another way to show what they understood.',
  date:'Community example',likes:7,replies:[],reports:0}
]

export default function Community(){
 const [posts,setPosts]=useStoredState<Post[]>('community-posts',starter)
 const [liked,setLiked]=useStoredState<number[]>('community-likes',[])
 const [bookmarks,setBookmarks]=useStoredState<number[]>('community-bookmarks',[])
 const [profile]=useStoredState<any>('profile',{name:'Aarohi Sharma',state:'Bihar'})
 const [topic,setTopic]=useState('All'),[query,setQuery]=useState(''),[open,setOpen]=useState(false)
 const [reply,setReply]=useState<Record<number,string>>({}),[report,setReport]=useState('')
 const [form,setForm]=useState({title:'',body:'',topic:'Multi-grade'})
 const [meId,setMeId]=useState<number|null>(null)
 const topics=['All','Multi-grade','Literacy','Mathematics','Inclusion']

 // Load shared posts from the backend; local starter posts are the offline view.
 useEffect(()=>{
  ;(async()=>{
   try{
    const [serverPosts,me]=await Promise.all([
     api.get<any[]>('/api/community/posts'),
     getToken()?api.get<any>('/api/auth/me').catch(()=>null):Promise.resolve(null)
    ])
    if(me)setMeId(me.id)
    if(Array.isArray(serverPosts)&&serverPosts.length){
     const mapped:Post[]=serverPosts.map(p=>({id:p.id,name:p.author,location:p.location||'',topic:p.topic,title:p.title,body:p.body,date:new Date(p.created_at).toLocaleDateString(),likes:0,replies:(p.replies||[]).map((r:any)=>({id:r.id,name:r.name,body:r.body})),reports:p.reports}))
     const localIds=new Set(mapped.map(p=>p.id))
     setPosts([...mapped,...posts.filter(p=>!localIds.has(p.id)&&p.id<1000000000000)])
    }
   }catch{}
  })()
 },[])

 const filtered=useMemo(()=>posts.filter(p=>
  p.reports<2&&(topic==='All'||p.topic===topic)&&
  `${p.title} ${p.body} ${p.name}`.toLowerCase().includes(query.toLowerCase())
 ),[posts,topic,query])

 async function create(){
  if(form.title.trim().length<5||form.body.trim().length<12)return
  if(getToken()){
   try{
    const p=await api.post<any>('/api/community/posts',{topic:form.topic,title:form.title.trim(),body:form.body.trim()})
    setPosts([{id:p.id,name:p.author,location:p.location||'',topic:p.topic,title:p.title,body:p.body,date:'Just now',likes:0,replies:[],reports:0},...posts])
    setForm({title:'',body:'',topic:'Multi-grade'});setOpen(false);return
   }catch(err:any){setReport(err.message||'Could not publish — sign in and try again.');setTimeout(()=>setReport(''),3000);return}
  }
  const p:Post={id:Date.now(),name:profile.name||'Teacher',location:profile.state||'',topic:form.topic,title:form.title.trim(),body:form.body.trim(),date:'Just now',likes:0,replies:[],reports:0}
  setPosts([p,...posts]);setForm({title:'',body:'',topic:'Multi-grade'});setOpen(false)
 }

 async function addReply(p:Post){
  const body=(reply[p.id]||'').trim();if(!body)return
  if(getToken()){
   try{
    const updated=await api.post<any>(`/api/community/posts/${p.id}/replies`,{body})
    setPosts(posts.map(x=>x.id===p.id?{...x,replies:(updated.replies||[]).map((r:any)=>({id:r.id,name:r.name,body:r.body}))}:x))
    setReply({...reply,[p.id]:''});return
   }catch(err:any){setReport(err.message||'Reply failed — sign in first.');setTimeout(()=>setReport(''),3000);return}
  }
  setPosts(posts.map(x=>x.id===p.id?{...x,replies:[...x.replies,{id:Date.now(),name:profile.name||'Teacher',body}]}:x))
  setReply({...reply,[p.id]:''})
 }

 async function flag(p:Post){
  setPosts(posts.map(x=>x.id===p.id?{...x,reports:x.reports+1}:x))
  if(getToken()){try{await api.post(`/api/community/posts/${p.id}/report`)}catch{}}
  setReport('Thanks. This post has been sent to the moderation queue.');setTimeout(()=>setReport(''),2400)
 }

 return <Layout title="Teacher community">
  <div className="page-heading"><div><div className="eyebrow">TEACHER COMMUNITY</div><h1>Good ideas grow when teachers share.</h1><p>Exchange practical classroom experiences. Protect student privacy and keep discussion respectful.</p></div>
   <button className="btn btn-primary" onClick={()=>setOpen(true)}>＋ Share a classroom idea</button></div>
  <div className="grid community-grid" style={{alignItems:'start'}}>
   <section className="panel">
    <div className="spread" style={{marginBottom:13}}>
     <div className="pill-tabs" style={{margin:0,flexWrap:'wrap'}}>{topics.map(t=><button key={t} className={topic===t?'selected':''} onClick={()=>setTopic(t)}>{t}</button>)}</div>
     <input className="input" style={{maxWidth:200}} placeholder="Search discussions" value={query} onChange={e=>setQuery(e.target.value)}/>
    </div>
    {filtered.map(p=><article className="post" key={p.id}>
     <div className="post-head"><span className="avatar" style={{width:28,height:28,fontSize:10}}>{p.name[0]}</span>
      <div><b>{p.name}</b><small> · {p.location} · {p.date}</small></div>
      <span className="tag" style={{marginLeft:'auto'}}>{p.topic}</span></div>
     <h3>{p.title}</h3><p>{p.body}</p>
     <div className="post-actions">
      <button onClick={()=>{setLiked(liked.includes(p.id)?liked.filter(i=>i!==p.id):[...liked,p.id]);setPosts(posts.map(x=>x.id===p.id?{...x,likes:x.likes+(liked.includes(p.id)?-1:1)}:x))}}>{liked.includes(p.id)?'♥':'♡'} {p.likes} helpful</button>
      <span>◌ {p.replies.length} replies</span>
      <button onClick={()=>setBookmarks(bookmarks.includes(p.id)?bookmarks.filter(i=>i!==p.id):[...bookmarks,p.id])}>{bookmarks.includes(p.id)?'★ Saved':'☆ Save'}</button>
      <button onClick={()=>flag(p)}>⚑ Report</button>
     </div>
     {p.replies.map(r=><div key={r.id} className="notice" style={{margin:'9px 0 0 25px',padding:9}}><b>{r.name}</b> · {r.body}</div>)}
     <div className="row" style={{marginTop:9,marginLeft:25}}>
      <input className="input" placeholder="Add a helpful reply…" value={reply[p.id]||''} onChange={e=>setReply({...reply,[p.id]:e.target.value})}/>
      <button className="btn btn-small" onClick={()=>addReply(p)}>Reply</button></div>
    </article>)}
    {filtered.length===0&&<div className="empty">No discussions match. Start a conversation with your peers.</div>}
   </section>
   <aside className="panel">
    <div className="panel-title"><div><h2>Community care</h2><p>Make this a useful space for everyone</p></div></div>
    <div className="notice">Share what worked and what you learned. Every classroom is different; offer ideas as possibilities, not prescriptions.</div>
    <ul style={{fontSize:10,color:'#68766d',lineHeight:2,paddingLeft:17}}>
     <li>Never include student names, photos or identifying details.</li>
     <li>Keep feedback kind, specific and practical.</li>
     <li>Report content that feels unsafe or inappropriate.</li></ul>
    <div className="divider"/>
    <div style={{fontSize:10,fontWeight:700,marginBottom:7}}>Your saved discussions</div>
    <div className="muted" style={{fontSize:9}}>{bookmarks.length} saved · {getToken()?'account + device':'stored on this device'}</div>
   </aside>
  </div>
  {open&&<div className="modal-backdrop"><div className="modal panel">
   <div className="spread"><div><h2>Share a classroom idea</h2><p className="muted" style={{fontSize:10}}>Describe an approach another teacher could adapt.</p></div><button className="btn btn-small" onClick={()=>setOpen(false)}>Close ×</button></div>
   <div className="field"><label>Topic</label><select value={form.topic} onChange={e=>setForm({...form,topic:e.target.value})}>{topics.slice(1).map(t=><option key={t}>{t}</option>)}</select></div>
   <div className="field"><label>Title</label><input maxLength={90} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="What did you try?"/></div>
   <div className="field"><label>Your experience</label><textarea maxLength={700} value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Share the context, what you did and what you noticed…"/></div>
   <div className="notice" style={{marginBottom:12}}>Do not include personal information about students or colleagues.{!getToken()?' You are not signed in — the post will be saved to this device only.':''}</div>
   <button className="btn btn-primary" disabled={form.title.trim().length<5||form.body.trim().length<12} onClick={create}>Publish to community →</button>
  </div></div>}
  {report&&<div className="toast">{report}</div>}
 </Layout>
}
