import {useEffect,useState} from 'react'
import Layout from '../components/Layout'
import {useStoredState} from '../lib/storage'
import {api,getToken} from '../lib/api'

type Source={title?:string;org?:string;url?:string;why?:string}
type Message={id:number;role:'teacher'|'assistant';text:string;sources?:Source[];mode?:string}

const start:Message[]=[{id:1,role:'assistant',text:'Namaste. I can help you shape a classroom activity, adapt a lesson for different learning levels, or think through a teaching challenge. Tell me the grade, subject and what you are working on.',sources:[{title:'THRIVE teaching guidance',org:'THRIVE',why:'opening message'}]}]

const SUGGESTIONS=[
 'How can I teach one maths idea across Grades 3 and 5?',
 'Suggest a low-cost reading activity for mixed levels.',
 'Help me make a quick check for understanding.',
 'What can I do when a group finishes early?'
]

export default function Assistant(){
 const [messages,setMessages]=useStoredState<Message[]>('assistant-messages',start)
 const [profile]=useStoredState<any>('profile',{state:'Bihar',board:'Bihar SCERT',medium:'Hindi + English',grades:'3, 5',subjects:'Mathematics'})
 const [text,setText]=useState(''),[language,setLanguage]=useState('English'),[busy,setBusy]=useState(false),[offline,setOffline]=useState(false)

 useEffect(()=>{
  if(!getToken())return
  ;(async()=>{
   try{
    const rows=await api.get<any[]>('/api/assistant/messages')
    if(Array.isArray(rows)&&rows.length){
     setMessages(rows.map(r=>({id:r.id,role:r.role,text:r.text,sources:r.sources||[]})))
    }
   }catch{}
  })()
 },[])

 async function send(q=text){
  if(!q.trim()||busy)return
  const next=[...messages,{id:Date.now(),role:'teacher' as const,text:q.trim()}]
  setMessages(next);setText('');setBusy(true)
  if(!getToken()){
   // Local guidance fallback for signed-out visitors (clearly labelled).
   await new Promise(r=>setTimeout(r,300))
   setMessages([...next,{id:Date.now()+1,role:'assistant',
    text:'You are not signed in, so this reply uses the built-in guidance patterns rather than curriculum retrieval. Create an account (or sign in from My profile) for source-grounded answers saved to your history.',
    sources:[{title:'THRIVE local guidance (unsigned)',org:'THRIVE',why:'no account session'}]}])
   setBusy(false);setOffline(true);return
  }
  try{
   const r=await api.post<any>('/api/assistant/chat',{message:q.trim(),language})
   setMessages(m=>[...m,{id:Date.now()+1,role:'assistant',text:r.reply,sources:r.sources||[],mode:r.mode}])
   setOffline(false)
  }catch(err:any){
   setMessages(m=>[...m,{id:Date.now()+1,role:'assistant',
    text:`I could not reach the assistant service (${err?.message||'network error'}). Your question is kept in this conversation — please retry in a moment.`,
    sources:[{title:'Service notice',org:'THRIVE',why:'backend unreachable'}]}])
   setOffline(true)
  }finally{setBusy(false)}
 }

 async function reset(){
  setMessages(start)
  if(getToken()){try{await api.delete('/api/assistant/messages')}catch{}}
 }

 return <Layout title="Teaching assistant">
  <div className="page-heading"><div><div className="eyebrow">TEACHING ASSISTANT</div><h1>Think through the next teaching move.</h1><p>Answers grounded in THRIVE's curriculum and pedagogy corpus, shaped by your teaching context.</p></div>
   <div className="field" style={{margin:0,minWidth:125}}><label>Response language</label><select value={language} onChange={e=>setLanguage(e.target.value)}><option>English</option><option>Hindi</option></select></div>
  </div>
  <div className="grid" style={{gridTemplateColumns:'minmax(0,1fr) 260px',alignItems:'start'}}>
   <section className="panel chat-box">
    <div className="panel-title"><div><h2>Teacher support</h2><p>Context: {profile.state||'Your state'} · Grades {profile.grades||'not set'} · {profile.subjects||'subjects not set'}</p></div><button className="btn btn-small" onClick={reset}>New conversation</button></div>
    <div className="chat-messages">
     {messages.map(m=><div className={'bubble '+(m.role==='teacher'?'mine':'')} key={m.id}>
      <div style={{whiteSpace:'pre-line'}}>{m.text}</div>
      {m.sources&&m.sources.length>0&&<div style={{fontSize:8,color:'#859189',borderTop:'1px solid #dfe9e1',marginTop:8,paddingTop:6}}>
       {m.sources.map((s,i)=><div key={i}>[{i+1}] {s.title}{s.org?` — ${s.org}`:''}{s.url?<a href={s.url} target="_blank" rel="noreferrer" style={{marginLeft:4}}>source ↗</a>:''}</div>)}
      </div>}
     </div>)}
     {busy&&<div className="bubble">Retrieving sources and drafting a practical suggestion…</div>}
    </div>
    <div className="chat-input"><input className="input" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Ask about a lesson, activity or classroom challenge…"/><button className="btn btn-primary" onClick={()=>send()} disabled={busy}>Send ↑</button></div>
    <div style={{fontSize:8,color:'#939d96',marginTop:7}}>{offline?'Assistant service unavailable — see the notice above.':'Sources shown per reply. Curriculum facts are retrieved; teaching moves are suggestions you control.'}</div>
   </section>
   <aside className="panel">
    <div className="panel-title"><div><h2>Try asking</h2><p>Start with a classroom situation</p></div></div>
    <div style={{display:'grid',gap:8}}>{SUGGESTIONS.map(q=><button className="btn" style={{textAlign:'left',lineHeight:1.5,justifyContent:'flex-start'}} onClick={()=>send(q)} key={q}>{q} <span style={{marginLeft:'auto'}}>→</span></button>)}</div>
    <div className="divider"/>
    <div className="notice">The assistant never replaces your professional judgement. Confirm curriculum-specific claims against your current official syllabus; THRIVE's seed corpus covers Grades 1–5 core chapters only.</div>
   </aside>
  </div>
 </Layout>
}
