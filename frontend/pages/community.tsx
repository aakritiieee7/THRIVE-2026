import {useEffect,useMemo,useState} from 'react'
import Layout from '../components/Layout'
import {useStoredState, EMPTY_PROFILE} from '../lib/storage'
import {api,getToken} from '../lib/api'

type Reply={id:number;name:string;body:string}
/* Server fields map 1:1 from /community/posts: author_id marks posts the
   signed-in teacher can edit/delete; helpful is the server vote count and
   my_helpful their own mark. localOnly posts exist only on this device. */
type Post={
 id:number;name:string;location:string;topic:string;title:string;body:string;date:string
 replies:Reply[];reports:number;authorId?:number|null;helpful?:number;myHelpful?:boolean
 localOnly?:boolean
}

function fromServer(p:any):Post{
 return {
  id:p.id,name:p.author||'Teacher',location:p.location||'',topic:p.topic,
  title:p.title,body:p.body,date:new Date(p.created_at).toLocaleDateString(),
  replies:(p.replies||[]).map((r:any)=>({id:r.id,name:r.name,body:r.body})),
  reports:p.reports||0,authorId:p.author_id??null,
  helpful:p.helpful||0,myHelpful:!!p.my_helpful,
 }
}

export default function Community(){
 const [posts,setPosts]=useStoredState<Post[]>('community-posts',[])
 const [liked,setLiked]=useStoredState<number[]>('community-likes',[])
 const [bookmarks,setBookmarks]=useStoredState<number[]>('community-bookmarks',[])
 const [profile]=useStoredState<any>('profile',EMPTY_PROFILE)
 const [topic,setTopic]=useState('All'),[query,setQuery]=useState(''),[open,setOpen]=useState(false)
 const [reply,setReply]=useState<Record<number,string>>({}),[report,setReport]=useState('')
 const [form,setForm]=useState({title:'',body:'',topic:'Multi-grade'})
 const [editing,setEditing]=useState<Post|null>(null)   // post being edited (author only)
 const [meId,setMeId]=useState<number|null>(null)
 const topics=['All','Multi-grade','Literacy','Mathematics','Inclusion']

 // Load shared posts from the backend; device-only posts stay as an offline view.
 useEffect(()=>{
  ;(async()=>{
   try{
    const [serverPosts,me]=await Promise.all([
     api.get<any[]>('/api/community/posts'),
     getToken()?api.get<any>('/api/auth/me').catch(()=>null):Promise.resolve(null)
    ])
    if(me)setMeId(me.id)
    if(Array.isArray(serverPosts)&&serverPosts.length){
     const mapped:Post[]=serverPosts.map(fromServer)
     const localIds=new Set(mapped.map(p=>p.id))
     // keep only this device's own offline posts — never resurrect stale mirrors
     setPosts([...mapped,...posts.filter(p=>p.localOnly&&p.id<1000000000000&&!localIds.has(p.id))])
    }
   }catch{}
  })()
 },[])

 const filtered=useMemo(()=>posts.filter(p=>
  p.reports<2&&(topic==='All'||p.topic===topic)&&
  `${p.title} ${p.body} ${p.name}`.toLowerCase().includes(query.toLowerCase())
 ),[posts,topic,query])

 async function create(){
  if(form.title.trim().length<5||form.body.trim().length<12||form.body.trim().length>4000||form.title.trim().length>160)return
  if(getToken()){
   try{
    const p=await api.post<any>('/api/community/posts',{topic:form.topic,title:form.title.trim(),body:form.body.trim()})
    setPosts([{...fromServer(p),date:'Just now'},...posts])
    setForm({title:'',body:'',topic:'Multi-grade'});setOpen(false);return
   }catch(err:any){setReport(err.message||'Could not publish right now — check your connection and try again.');setTimeout(()=>setReport(''),3000);return}
  }
  const p:Post={id:Date.now(),name:profile.name||'Teacher',location:profile.state||'',topic:form.topic,
   title:form.title.trim(),body:form.body.trim(),date:'Just now',replies:[],reports:0,
   authorId:null,helpful:0,myHelpful:false,localOnly:true}
  setPosts([p,...posts]);setForm({title:'',body:'',topic:'Multi-grade'});setOpen(false)
 }

 /* Author edit: same PostIn rules as create (title 5–160, body 12–4000). */
 async function saveEdit(){
  if(!editing)return
  const title=editing.title.trim(),body=editing.body.trim()
  if(title.length<5||title.length>160||body.length<12||body.length>4000)return
  if(getToken()){
   try{
    const updated=await api.put<any>(`/api/community/posts/${editing.id}`,
     {topic:editing.topic,title,body})
    setPosts(posts.map(x=>x.id===editing.id?{...fromServer(updated),date:x.date}:x))
    setEditing(null);setReport('Your post has been updated.');setTimeout(()=>setReport(''),2400);return
   }catch(err:any){setReport(err.message||'Could not save your changes right now — try again in a moment.');setTimeout(()=>setReport(''),3000);return}
  }
  setPosts(posts.map(x=>x.id===editing.id?{...x,title,body,topic:editing.topic}:x))
  setEditing(null)
 }

 async function removePost(p:Post){
  if(!confirm('Delete this post for everyone? This cannot be undone.'))return
  if(getToken()&&p.authorId!=null){
   try{await api.delete(`/api/community/posts/${p.id}`)}catch{}
  }
  setPosts(posts.filter(x=>x.id!==p.id))
  setReport('Post deleted.');setTimeout(()=>setReport(''),2000)
 }

 /* Helpful: server-voted when signed in (one vote per teacher per post);
    guests get an honest device-only mark. */
 async function toggleHelpful(p:Post){
  if(p.localOnly){
   setLiked(liked.includes(p.id)?liked.filter(i=>i!==p.id):[...liked,p.id]);return
  }
  if(getToken()){
   try{
    const r=await api.post<{helpful:number;my_helpful:boolean}>(`/api/community/posts/${p.id}/helpful`)
    setPosts(posts.map(x=>x.id===p.id?{...x,helpful:r.helpful,myHelpful:r.my_helpful}:x))
    return
   }catch{}
  }
  // Signed out: local mirror only, clearly labelled as device-only in the UI.
  const on=liked.includes(p.id)
  setLiked(on?liked.filter(i=>i!==p.id):[...liked,p.id])
  setPosts(posts.map(x=>x.id===p.id?{...x,helpful:Math.max(0,(x.helpful||0)+(on?-1:1)),myHelpful:!on}:x))
 }

 async function addReply(p:Post){
  const body=(reply[p.id]||'').trim();if(!body)return
  if(getToken()){
   try{
    const updated=await api.post<any>(`/api/community/posts/${p.id}/replies`,{body})
    setPosts(posts.map(x=>x.id===p.id?{...x,replies:(updated.replies||[]).map((r:any)=>({id:r.id,name:r.name,body:r.body}))}:x))
    setReply({...reply,[p.id]:''});return
   }catch(err:any){setReport(err.message||'Could not post your reply right now — try again in a moment.');setTimeout(()=>setReport(''),3000);return}
  }
  setPosts(posts.map(x=>x.id===p.id?{...x,replies:[...x.replies,{id:Date.now(),name:profile.name||'Teacher',body}]}:x))
  setReply({...reply,[p.id]:''})
 }

 async function flag(p:Post){
  setPosts(posts.map(x=>x.id===p.id?{...x,reports:x.reports+1}:x))
  if(getToken()){try{await api.post(`/api/community/posts/${p.id}/report`)}catch{}}
  setReport('Thanks. This post has been sent to the moderation queue.');setTimeout(()=>setReport(''),2400)
 }

 const isMine=(p:Post)=>meId!=null&&p.authorId!=null&&p.authorId===meId

 return <Layout title="Teacher community">
  <div className="page-heading"><div><div className="eyebrow">Teacher community</div><h1>Good ideas grow when teachers share.</h1><p>Exchange practical classroom experiences. Protect student privacy and keep discussion respectful.</p></div>
   <button className="btn btn-primary" onClick={()=>setOpen(true)}>＋ Share a classroom idea</button></div>
  <div className="grid community-grid" style={{alignItems:'start'}}>
   <section className="panel">
    <div className="spread" style={{marginBottom:13}}>
     <div className="pill-tabs" style={{margin:0,flexWrap:'wrap'}}>{topics.map(t=><button key={t} className={topic===t?'selected':''} onClick={()=>setTopic(t)}>{t}</button>)}</div>
     <input className="input" style={{maxWidth:200}} placeholder="Search discussions" value={query} onChange={e=>setQuery(e.target.value)}/>
    </div>
    {filtered.map(p=>{
     const marked=p.myHelpful||liked.includes(p.id)
     const count=(p.helpful||0)+(p.localOnly&&liked.includes(p.id)&&!p.myHelpful?1:0)
     return <article className="post" key={p.id}>
     <div className="post-head"><span className="avatar" style={{width:28,height:28,fontSize:10}}>{p.name[0]}</span>
      <div><b>{p.name}</b><small> · {p.location} · {p.date}</small>{isMine(p)&&<span className="tag" style={{marginLeft:6,fontSize:8.5}}>Your post</span>}</div>
      <span className="tag" style={{marginLeft:'auto'}}>{p.topic}</span></div>
     <h3>{p.title}</h3><p>{p.body}</p>
     <div className="post-actions">
      <button onClick={()=>toggleHelpful(p)} aria-pressed={marked}
        title={getToken()||p.localOnly?'One mark per teacher':'Marked helpful on this device only'}>
        {marked?`♥ Marked helpful (${count})`:`♡ Helpful${count?` (${count})`:''}`}</button>
      <span>◌ {p.replies.length} {p.replies.length===1?'reply':'replies'}</span>
      {p.localOnly&&<span className="tag" style={{fontSize:8.5}}>On this device</span>}
      <button onClick={()=>setBookmarks(bookmarks.includes(p.id)?bookmarks.filter(i=>i!==p.id):[...bookmarks,p.id])}>{bookmarks.includes(p.id)?'★ Saved':'☆ Save'}</button>
      {isMine(p)&&<>
       <button onClick={()=>setEditing({...p})} aria-label="Edit your post">✎ Edit</button>
       <button onClick={()=>removePost(p)} aria-label="Delete your post">🗑 Delete</button>
      </>}
      {!isMine(p)&&<button onClick={()=>flag(p)}>⚑ Report</button>}
     </div>
     {p.replies.map(r=><div key={r.id} className="notice" style={{margin:'9px 0 0 25px',padding:9}}><b>{r.name}</b> · {r.body}</div>)}
     <div className="row" style={{marginTop:9,marginLeft:25}}>
      <input className="input" placeholder="Add a helpful reply…" value={reply[p.id]||''} onChange={e=>setReply({...reply,[p.id]:e.target.value})}/>
      <button className="btn btn-small" onClick={()=>addReply(p)}>Reply</button></div>
    </article>})}
    {filtered.length===0&&<div className="empty">
      {posts.length===0
        ? <>No discussions yet. Be the first to share something useful from your classroom.</>
        : <>No discussions match your filters. Try another topic or clear the search.</>}</div>}
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
    <div className="muted" style={{fontSize:9}}>{bookmarks.length} saved · {getToken()?'bookmarked to your account':'stored on this device'}</div>
   </aside>
  </div>
  {open&&<div className="modal-backdrop"><div className="modal panel">
   <div className="spread"><div><h2>Share a classroom idea</h2><p className="muted" style={{fontSize:10}}>Describe an approach another teacher could adapt.</p></div><button className="btn btn-small" onClick={()=>setOpen(false)}>Close ×</button></div>
   <div className="field"><label>Topic</label><select value={form.topic} onChange={e=>setForm({...form,topic:e.target.value})}>{topics.slice(1).map(t=><option key={t}>{t}</option>)}</select></div>
   <div className="field"><label>Title</label><input maxLength={160} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="What did you try?"/></div>
   <div className="field"><label>Your experience</label><textarea maxLength={4000} value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Share the context, what you did and what you noticed…"/></div>
   <div className="notice" style={{marginBottom:12}}>Do not include personal information about students or colleagues.{!getToken()?' You are not signed in — the post will be saved to this device only.':''}</div>
   <button className="btn btn-primary" disabled={form.title.trim().length<5||form.body.trim().length<12} onClick={create}>Publish to community</button>
  </div></div>}
  {editing&&<div className="modal-backdrop"><div className="modal panel">
   <div className="spread"><div><h2>Edit your post</h2><p className="muted" style={{fontSize:10}}>Only you can change this post.</p></div><button className="btn btn-small" onClick={()=>setEditing(null)}>Close ×</button></div>
   <div className="field"><label>Topic</label><select value={editing.topic} onChange={e=>setEditing({...editing,topic:e.target.value})}>{topics.slice(1).map(t=><option key={t}>{t}</option>)}</select></div>
   <div className="field"><label>Title</label><input maxLength={160} value={editing.title} onChange={e=>setEditing({...editing,title:e.target.value})}/></div>
   <div className="field"><label>Your experience</label><textarea maxLength={4000} value={editing.body} onChange={e=>setEditing({...editing,body:e.target.value})}/></div>
   <button className="btn btn-primary" disabled={editing.title.trim().length<5||editing.body.trim().length<12} onClick={saveEdit}>Save changes</button>
  </div></div>}
  {report&&<div className="toast" aria-live="polite">{report}</div>}
 </Layout>
}
