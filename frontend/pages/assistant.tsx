import {useEffect,useRef,useState} from 'react'
import Layout from '../components/Layout'
import {useStoredState} from '../lib/storage'
import {api,getToken,ApiError} from '../lib/api'
import {ensureGuest,guestHeaders} from '../lib/guest'
import {IllEmpty} from '../components/Illustrations'
import {createRecognizer,speechSupported,VoiceState} from '../lib/voice'
import {IconAlert,IconCheck,IconExternal,IconSparkle} from '../components/Icons'

type Source={title?:string;org?:string;url?:string;why?:string}
type Message={id:number;role:'teacher'|'assistant';text:string;sources?:Source[];mode?:string}

const start:Message[]=[{id:1,role:'assistant',text:'Namaste. I can help you shape a classroom activity, adapt a lesson for different learning levels, or think through a teaching challenge. Tell me the grade, subject and what you are working on.',sources:[{title:'THRIVE teaching guidance',org:'THRIVE',why:'opening message'}],mode:'grounded'}]

const SUGGESTIONS=[
 'How can I teach one maths idea across Grades 3 and 5?',
 'Suggest a low-cost reading activity for mixed levels.',
 'Help me make a quick check for understanding.',
 'What can I do when a group finishes early?'
]

/* Follow-up actions: each composes a new message that keeps the thread's
   context (what the teacher last asked about) so the reply stays on topic. */
const FOLLOWUPS=[
 'Simplify this explanation',
 'Adapt this activity for another grade',
 'Create a worksheet',
 'Suggest a low-cost teaching aid',
 'Generate a quick assessment',
 'Provide an alternative activity',
]

function modeLabel(mode?:string){
 if(!mode)return null
 if(mode==='llm-grounded')return {cls:'llm',text:'Grounded · AI-drafted'}
 if(mode==='local-grounded')return {cls:'local',text:'Pattern guidance'}
 return {cls:'grounded',text:'Grounded'}
}

/* Distinguish retrieved corpus sources from the engine's own suggestions. */
function sourceKind(s:Source){
 const why=(s.why||'').toLowerCase()
 if(why.includes('matched')||why.includes('retrieved'))return {label:'Retrieved',retrieved:true}
 if(why.includes('fallback')||why.includes('pattern')||why.includes('general pedagogy'))return {label:'Suggestion',retrieved:false}
 if(why.includes('no account')||why.includes('unreachable')||why.includes('notice'))return {label:'Notice',retrieved:false}
 return {label:'Reference',retrieved:false}
}

export default function Assistant(){
 const [messages,setMessages]=useStoredState<Message[]>('assistant-messages',start)
 const [profile]=useStoredState<any>('profile',{state:'Bihar',board:'Bihar SCERT',medium:'Hindi + English',grades:'3, 5',subjects:'Mathematics'})
 const [plans]=useStoredState<any[]>('plans',[])
 const [text,setText]=useState(''),[language,setLanguage]=useState('English'),[busy,setBusy]=useState(false),[offline,setOffline]=useState(false)
 const [suggested,setSuggested]=useState(false)
 const [voice,setVoice]=useState<VoiceState>('idle')
 const [heard,setHeard]=useState('')
 const recRef=useRef<ReturnType<typeof createRecognizer>|null>(null)
 const scroller=useRef<HTMLDivElement>(null)

 // Recreate the recognizer when the response language changes (hi-IN vs en-IN).
 useEffect(()=>{
  recRef.current=createRecognizer({
   lang: language==='Hindi'?'hi-IN':'en-IN',
   onState:setVoice,
   onText:(t)=>{setText(prev=>prev?prev+' '+t:t);setHeard(t)}
  })
  return ()=>{try{recRef.current?.stop()}catch{}}
 },[language])

 function toggleMic(){
  const rec=recRef.current
  if(!rec){setVoice('unsupported');return}
  if(voice==='listening'){rec.stop();return}
  setHeard('')
  if(!rec.supported){setVoice('unsupported');return}
  rec.start()
 }

 // Keep the conversation scrolled to the newest reply.
 useEffect(()=>{
  const el=scroller.current
  if(el)el.scrollTop=el.scrollHeight
 },[messages,busy])

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
   // Signed-out visitors: real assistant answers under the guest quota
   // (server-enforced). No fake replies.
   const sess=await ensureGuest()
   if(!sess){
    setMessages([...next,{id:Date.now()+1,role:'assistant',
     text:'Could not start a guest session — the backend may be offline. Reload in a moment, or create an account for guaranteed access.',
     sources:[{title:'Service notice',org:'THRIVE',why:'backend unreachable'}],mode:'local-grounded'}])
    setBusy(false);return
   }
   try{
    const r=await api.post<any>('/api/guest/ask',{message:q.trim(),language},guestHeaders())
    setMessages(m=>[...m,{id:Date.now()+1,role:'assistant',text:r.reply,sources:r.sources||[],mode:r.mode}])
    setOffline(false)
   }catch(err:any){
    const msg=err instanceof ApiError&&(err.status===401||err.status===429)
     ? err.message
     : `I could not reach the assistant service (${err?.message||'network error'}). Your question is kept in this conversation — please retry in a moment.`
    setMessages(m=>[...m,{id:Date.now()+1,role:'assistant',
      text:msg,
      sources:[{title:'Service notice',org:'THRIVE',why:'backend unreachable'}],
      mode:err instanceof ApiError&&(err.status===401||err.status===429)?'local-grounded':'local-grounded'}])
    setOffline(!(err instanceof ApiError&&(err.status===401||err.status===429)))
   }finally{setBusy(false)}
   return
  }
  // Signed-in: persisted chat with account history.
  try{
   const r=await api.post<any>('/api/assistant/chat',{message:q.trim(),language})
   setMessages(m=>[...m,{id:Date.now()+1,role:'assistant',text:r.reply,sources:r.sources||[],mode:r.mode}])
   setOffline(false)
  }catch(err:any){
   setMessages(m=>[...m,{id:Date.now()+1,role:'assistant',
    text:`I could not reach the assistant service (${err?.message||'network error'}). Your question is kept in this conversation — please retry in a moment.`,
    sources:[{title:'Service notice',org:'THRIVE',why:'backend unreachable'}],mode:'local-grounded'}])
   setOffline(true)
  }finally{setBusy(false)}
 }

 /* Follow-ups reuse the last teacher question so context carries over.
    The pasted topic is clipped hard — earlier messages are already wrapped in
    "building on: …" by this same function, so without a cap each click nests
    another full copy of the thread and the text turns into unreadable snowballs. */
 function sendFollowup(action:string){
  const lastTeacher=[...messages].reverse().find(m=>m.role==='teacher')
  let topic=lastTeacher?lastTeacher.text.trim():'our earlier discussion'
  // strip any prior "building on: …" wrapper so we only ever quote the original ask
  topic=topic.replace(/,?\s*building on:[\s\S]*$/i,'').trim()||'our earlier discussion'
  if(topic.length>160)topic=topic.slice(0,157).trimEnd()+'…'
  const gradeHint=profile.grades?` for Grades ${profile.grades}`:''
  const subject=profile.subjects?` in ${profile.subjects}`:''
  send(`${action}${gradeHint}${subject}, building on: “${topic}”.`)
 }

 async function reset(){
  setMessages(start)
  if(getToken()){try{await api.delete('/api/assistant/messages')}catch{}}
 }

 const lastAssistant=[...messages].reverse().find(m=>m.role==='assistant')
 const lastPlan=plans[0]
 const ctxBits=[
  profile.state&&`${profile.state} · ${profile.board||'board not set'}`,
  profile.grades&&`Grades ${profile.grades}`,
  profile.subjects,
  lastPlan&&lastPlan.subject?`latest plan: ${lastPlan.subject}`:'',
 ].filter(Boolean)

 return <Layout title="Teaching assistant">
  <div className="page-heading"><div><div className="eyebrow">Teaching assistant</div><h1>Think through the next teaching move.</h1><p>Answers grounded in THRIVE's curriculum and pedagogy corpus, shaped by your teaching context.</p></div>
   <div className="field" style={{margin:0,minWidth:125}}><label>Response language</label><select value={language} onChange={e=>setLanguage(e.target.value)}><option>English</option><option>Hindi</option></select></div>
  </div>
  <div className="grid" style={{gridTemplateColumns:'minmax(0,1fr) 260px',alignItems:'start'}}>
   <section className="panel chat-box">
    <div className="panel-title"><div><h2>Teacher support</h2><p>Replies use your profile context — confirm syllabus-specific claims.</p></div><button className="btn btn-small" onClick={reset}>New conversation</button></div>
    {ctxBits.length>0&&<div className="ctx-strip" style={{marginBottom:10}}>
     {ctxBits.map((c,i)=><span className="ctx-pill" key={i}>{c}</span>)}
    </div>}
    <div className="chat-messages" ref={scroller}>
     {messages.length<=1&&<div className="empty" style={{padding:'16px 8px'}}>
      <IllEmpty size={110} />
      <div style={{fontWeight:700,marginBottom:6}}>Suggested prompts</div>
      <div style={{display:'grid',gap:7,marginTop:4}}>
       {['Grade 2, 3 and 4 in one classroom — 40 minutes for mathematics, what should I do?',
         'How do I check understanding with only chalk and paper?',
         'Explain evaporation for Grade 5 in simple Hindi-friendly terms.'].map(q=>
        <button className="btn btn-small" key={q} style={{textAlign:'left',justifyContent:'flex-start',lineHeight:1.5}}
         onClick={()=>send(q)}>{q}</button>)}
      </div>
      {!getToken()&&<small className="muted" style={{fontSize:10,marginTop:8,display:'block'}}>
       You are using the free guest session — answers are server-grounded, and your conversation is not saved to an account yet.</small>}
     </div>}
     {messages.map(m=><div className={'bubble '+(m.role==='teacher'?'mine':'')} key={m.id}>
      <div style={{whiteSpace:'pre-line'}}>{m.text}</div>
      {m.role==='assistant'&&modeLabel(m.mode)&&<div style={{marginTop:6}}>
        <span className={'mode-badge '+modeLabel(m.mode)!.cls}>{modeLabel(m.mode)!.text}</span>
      </div>}
      {m.sources&&m.sources.length>0&&<div className="sources-box">
       {m.sources.map((s,i)=>{const kind=sourceKind(s);return <div className="src" key={i}>
         {kind.retrieved?<IconCheck size={12}/>:<IconAlert size={12}/>}
         <span>
          <b>[{i+1}] {s.title||'Source'}</b>
          {s.org?<span style={{color:'var(--faint)'}}> — {s.org}</span>:''}
          <span style={{marginLeft:6,fontWeight:700,color:kind.retrieved?'var(--forest-deep)':'var(--honey-deep)'}}>{kind.label}</span>
          {s.why&&<span style={{display:'block',fontSize:9.5,color:'var(--faint)'}}>{s.why}</span>}
          {s.url&&<a href={s.url} target="_blank" rel="noreferrer" style={{marginLeft:4}}>Open source <IconExternal size={10} style={{display:'inline'}}/></a>}
         </span>
        </div>})}
      </div>}
     </div>)}
     {busy&&<div className="bubble">Retrieving sources and drafting a practical suggestion…</div>}
    </div>
    {lastAssistant&&!busy&&<div className="followups" aria-label="Follow-up actions">
     {FOLLOWUPS.map(f=><button className="followup" key={f} onClick={()=>sendFollowup(f)}>
       <IconSparkle size={11} style={{display:'inline',marginRight:4,verticalAlign:'-1px'}}/>{f}
      </button>)}
    </div>}
    <div className="chat-input">
     <button className={'mic-btn'+(voice==='listening'?' live':'')} onClick={toggleMic}
       aria-label={voice==='listening'?'Stop voice input':'Ask by voice'} title={voice==='listening'?'Stop listening':'Speak your question'}>
      {voice==='listening'?'■':'●'}
     </button>
     <input className="input" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder={voice==='listening'?'Listening… speak in '+(language==='Hindi'?'Hindi':'English'):'Ask about a lesson, activity or classroom challenge…'}/>
     <button className="btn btn-primary" onClick={()=>send()} disabled={busy}>Send ↑</button>
    </div>
    {voice==='listening'&&<div className="voice-status">Listening — speak now, then tap the mic again if it keeps recording.</div>}
    {voice==='unsupported'&&<div className="voice-status">Voice input is not available in this browser. Type your question instead, or open THRIVE in Chrome or Edge.</div>}
    {heard&&voice==='idle'&&<div className="voice-status idle">Heard: “{heard}” — edit the text before sending if anything was misheard.</div>}
    <div style={{fontSize:9,color:'var(--muted)',marginTop:7,lineHeight:1.6}}>{offline?'Assistant service unavailable — see the notice above.':'Retrieved sources are from THRIVE’s curriculum corpus; suggestions and pattern replies are labelled as such — they are not curriculum facts.'}</div>
   </section>
   <aside className="panel">
    <div className="panel-title"><div><h2>Try asking</h2><p>Start with a classroom situation</p></div></div>
    <div style={{display:'grid',gap:8}}>{SUGGESTIONS.map(q=><button className="btn" style={{textAlign:'left',lineHeight:1.5,justifyContent:'flex-start'}} onClick={()=>send(q)} key={q}>{q}</button>)}</div>
    <div className="divider"/>
    <div style={{fontSize:10,fontWeight:700,marginBottom:7}}>After any reply</div>
    <div className="muted" style={{fontSize:9.5,lineHeight:1.7,marginBottom:10}}>Six follow-up actions appear under each answer — simplify, adapt for another grade, create a worksheet, suggest a low-cost aid, generate an assessment, or ask for an alternative activity.</div>
    <div className="notice">The assistant never replaces your professional judgement. Confirm curriculum-specific claims against your current official syllabus; THRIVE's seed corpus covers Grades 1–5 core chapters only.</div>
   </aside>
  </div>
 </Layout>
}
