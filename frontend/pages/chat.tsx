import {useEffect,useRef,useState} from 'react'
import Link from 'next/link'
import Layout from '../components/Layout'
import {useStoredState, EMPTY_PROFILE} from '../lib/storage'
import {api,getToken} from '../lib/api'
import {createRecognizer,speechSupported,VoiceState} from '../lib/voice'
import {IconAlert,IconCheck,IconCopy,IconDownload,IconLayers,IconLink,IconSave} from '../components/Icons'
import {savePlan} from '../lib/plans'

type Source={title?:string;org?:string;url?:string;why?:string}
/* plan: compiled schedule the engine returned with this reply (raw bridge
   response carries it; chat endpoint carries it too since ChatOut gained the
   field). saved_id: a WhatsApp command that persisted a plan (#N). */
type Msg={
 id:number;role:'teacher'|'thrive';text:string;ts:string
 sources?:Source[];mode?:string;plan?:any;savedId?:number|string;draft?:boolean
}
type AppCtx={from:string;title:string;reply:string;sources:Source[];ts:number}

const hello:Msg[]=[{id:1,role:'thrive',
 text:'Namaste. This is THRIVE chat — the same assistant that lives in Teaching assistant, shaped for quick messages like WhatsApp. Ask about a lesson, an activity, or a classroom challenge.',
 ts:''}]

const QUICK=[
 'How do I teach fractions to Grade 4 and Grade 2 in one period?',
 'Suggest a reading activity with only chalk and paper.',
 'What is a good 5-minute check for understanding?',
 'How do I settle a noisy class without shouting?'
]

function sourceKind(s:Source){
 const why=(s.why||'').toLowerCase()
 if(why.includes('matched')||why.includes('retrieved'))return {label:'Retrieved',retrieved:true}
 if(why.includes('fallback')||why.includes('pattern')||why.includes('general pedagogy'))return {label:'Suggestion',retrieved:false}
 if(why.includes('no account')||why.includes('notice')||why.includes('connection'))return {label:'Notice',retrieved:false}
 return {label:'Reference',retrieved:false}
}

async function copyText(t:string){
 try{await navigator.clipboard.writeText(t)}catch{}
}
function downloadText(filename:string,text:string){
 const blob=new Blob([text],{type:'text/plain;charset=utf-8'})
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click()
 URL.revokeObjectURL(a.href)
}
function toast(t:string){
 const el=document.createElement('div');el.className='toast';el.setAttribute('aria-live','polite');el.textContent=t
 document.body.appendChild(el);setTimeout(()=>el.remove(),2600)
}

export default function Chat(){
 const [msgs,setMsgs]=useStoredState<Msg[]>('chat-messages',hello)
 const [profile]=useStoredState<any>('profile',EMPTY_PROFILE)
 const [text,setText]=useState(''),[language,setLanguage]=useState('English')
 const [busy,setBusy]=useState(false),[voice,setVoice]=useState<VoiceState>('idle')
 const [heard,setHeard]=useState('')
 const [waStatus,setWaStatus]=useState<any>(null)
 const [mounted,setMounted]=useState(false)
 const [ctx,setCtx]=useState<AppCtx|null>(null)   // handoff from Teaching assistant
 const scroller=useRef<HTMLDivElement>(null)
 const recRef=useRef<ReturnType<typeof createRecognizer>|null>(null)

 // speechSupported() reads window, so it is false on the server and true in
 // a capable browser — render it only after mount or hydration mismatches.
 useEffect(()=>{setMounted(true)},[])
 useEffect(()=>{api.get<any>('/api/assistant/whatsapp/status').then(setWaStatus).catch(()=>setWaStatus(null))},[])

 // One-time handoff from Teaching assistant (sessionStorage, not shared state).
 useEffect(()=>{
  try{
   const raw=sessionStorage.getItem('thrive:appContext')
   if(raw){setCtx(JSON.parse(raw));sessionStorage.removeItem('thrive:appContext')}
  }catch{}
 },[])

 useEffect(()=>{
  recRef.current=createRecognizer({
   lang:language==='Hindi'?'hi-IN':'en-IN',
   onState:setVoice,
   onText:(t)=>{setText(prev=>prev?prev+' '+t:t);setHeard(t)}
  })
  return ()=>{try{recRef.current?.stop()}catch{}}
 },[language])

 useEffect(()=>{
  const el=scroller.current
  if(el)el.scrollTop=el.scrollHeight
 },[msgs,busy])

 function toggleMic(){
  const rec=recRef.current
  if(!rec){setVoice('unsupported');return}
  if(voice==='listening'){rec.stop();return}
  setHeard('')
  if(!rec.supported){setVoice('unsupported');return}
  rec.start()
 }

 async function send(q=text){
  if(!q.trim()||busy)return
  const mine:Msg={id:Date.now(),role:'teacher',text:q.trim(),ts:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
  const next=[...msgs,mine]
  setMsgs(next);setText('');setBusy(true)
  try{
   // Signed-in teachers go through the persisted chat; everyone else uses
   // the open bridge so chat still works straight from a phone browser.
   let reply:string,sources:Source[]=[],mode:string|undefined,plan:any,savedId:number|string|undefined
   if(getToken()){
    const r=await api.post<any>('/api/assistant/chat',{message:mine.text,language})
    reply=r.reply;sources=r.sources||[];mode=r.mode;plan=r.plan||undefined
   }else{
    const r=await api.post<any>('/api/assistant/bridge',{
     channel:'webchat',from:'web-visitor',message:mine.text,language,
     profile:{state:profile.state,grades:profile.grades,subjects:profile.subjects}
    })
    reply=r.reply;sources=r.sources||[];mode=r.mode;plan=r.plan||undefined;savedId=r.saved_id||undefined
   }
   setMsgs(m=>[...m,{id:Date.now()+1,role:'thrive',text:reply,sources,mode,ts:'',plan,savedId}])
  }catch(err:any){
   setMsgs(m=>[...m,{id:Date.now()+1,role:'thrive',ts:'',
    text:`I could not reach THRIVE right now (${err?.message||'please try again in a moment'}). Your message is saved here — try again in a moment.`}])
  }finally{setBusy(false)}
 }

 function update(id:number,patch:Partial<Msg>){
  setMsgs(ms=>ms.map(m=>m.id===id?{...m,...patch}:m))
 }

 async function saveDraft(m:Msg){
  const inputs=m.plan?.inputs||{}
  const subject=inputs.subject||m.plan?.subject||profile.subjects?.split(',')[0]||'Classroom note'
  const item={
   title:`${subject} — chat reply`,subject,medium:profile.medium||'',board:profile.board||'',
   minutes:Number(inputs.minutes)||40,
   grades:(inputs.grades||[]).map((g:string)=>({grade:String(g),topic:inputs.topics?.[String(g)]||'',objective:'',shared:''})),
   schedule:m.plan?.slots||[],assessments:m.plan?.assessments||[],sources:m.sources||[],
   draft:m.text,savedAt:new Date().toISOString(),
  }
  const stored=await savePlan(item as any)
  update(m.id,{draft:true})
  toast(m.savedId?`Plan #${m.savedId} already saved — a draft copy is in My resources`:'Saved to My resources as a draft')
 }

 async function openPlan(m:Msg){
  if(!m.plan){toast('No compiled schedule in this reply');return}
  const inputs=m.plan.inputs||{}
  const grades=(inputs.grades||[]).map((g:string)=>({grade:String(g),topic:inputs.topics?.[String(g)]||'',objective:'',shared:''}))
  const item:any={
   title:`${inputs.subject||m.plan.subject||'Lesson plan'}: ${grades.map((g:any)=>`Grade ${g.grade}`).join(' & ')}`,
   subject:inputs.subject||m.plan.subject||'Mathematics',
   medium:profile.medium||'',board:profile.board||'',
   minutes:Number(inputs.minutes)||40,grades,
   schedule:m.plan.slots||[],assessments:m.plan.assessments||[],sources:m.plan.sources||m.sources||[],
   savedAt:new Date().toISOString(),
  }
  const stored=await savePlan(item)
  sessionStorage.setItem('thrive:openPlan',JSON.stringify(stored))
  window.location.href=`/compiler?open=${encodeURIComponent(String(stored.id))}`
 }

 function share(m:Msg){
  const prev=msgs.find(x=>x.id<m.id&&x.role==='teacher')
  const body=prev?`${prev.text}\n\n${m.text}`:m.text
  window.open('https://wa.me/?text='+encodeURIComponent(body.slice(0,1800)),'_blank','noopener')
 }

 async function clearThread(){
  setMsgs(hello)
  if(getToken()){try{await api.delete('/api/assistant/messages')}catch{}}
 }

 return <Layout title="Chat with THRIVE">
  <div className="page-heading"><div><div className="eyebrow">Chat with THRIVE</div><h1>Message THRIVE the way you message anyone.</h1><p>A WhatsApp-style thread backed by the same grounded assistant — type, speak, or connect your phone.</p></div>
   <div className="field" style={{margin:0,minWidth:125}}><label>Reply language</label><select value={language} onChange={e=>setLanguage(e.target.value)}><option>English</option><option>Hindi</option></select></div>
  </div>

  {/* Handoff banner from Teaching assistant */}
  {ctx&&<div className="notice" style={{marginBottom:12}}>
   <b>From your Teaching assistant:</b> “{ctx.title}”
   <div style={{marginTop:7,display:'flex',gap:7,flexWrap:'wrap'}}>
    <button className="btn btn-small" onClick={()=>{setText(ctx.reply.slice(0,500))}}>Insert reply as draft</button>
    <button className="btn btn-small" onClick={async()=>{await copyText(ctx.reply);toast('Reply copied')}}><IconCopy size={12}/> Copy</button>
    <button className="btn btn-small" onClick={()=>{downloadText('thrive-reply.txt',[ctx.reply,...ctx.sources.map((s,i)=>`[${i+1}] ${s.title||'Source'}`)].join('\n'));toast('Exported')}}><IconDownload size={12}/> Export</button>
    <button className="btn btn-small" onClick={()=>{setCtx(null)}}>Dismiss</button>
   </div>
  </div>}

  <div className="chat-shell">
   <div className="spread" style={{marginBottom:10}}>
    <span className="muted" style={{fontSize:10}}>Same grounded assistant as Teaching assistant · history saved{getToken()?' to your account':' on this device'}</span>
    <button className="btn btn-small" onClick={clearThread}>Clear conversation</button>
   </div>
   <section className="chat-stage" ref={scroller}>
    {msgs.map(m=><div className={'bubble '+(m.role==='teacher'?'mine':'')} key={m.id}>
     <div style={{whiteSpace:'pre-line'}}>{m.text}</div>
     {m.role==='thrive'&&m.mode&&<div style={{marginTop:6}}>
      <span className={'mode-badge '+
       (m.mode==='llm-grounded'?'llm':m.mode==='local-grounded'?'local':'grounded')}>
       {m.mode==='llm-grounded'?'Grounded · AI-drafted':m.mode==='local-grounded'?'Pattern guidance':'Grounded'}
      </span>
      {m.plan&&<span className="mode-badge grounded" style={{marginLeft:6}}>Compiled schedule</span>}
      {m.savedId&&<span className="mode-badge local" style={{marginLeft:6}}>Plan #{m.savedId}</span>}
     </div>}
     {m.role==='thrive'&&m.plan&&<div className="notice" style={{marginTop:8,padding:'7px 9px',fontSize:10.5}}>
      A compiled multi-grade schedule is in this reply.
      <button className="btn btn-small" style={{marginLeft:8}} onClick={()=>openPlan(m)}>
       <IconLayers size={12}/> Open in Curriculum Studio</button>
     </div>}
     {m.role==='thrive'&&m.savedId&&<div className="notice" style={{marginTop:8,padding:'7px 9px',fontSize:10.5}}>
      Saved as plan #{m.savedId} to your account — <Link href="/resources">open it in My resources</Link>.
     </div>}
     {m.role==='thrive'&&m.sources&&m.sources.length>0&&
      <details className="sources-box">
       <summary style={{cursor:'pointer',fontSize:10,fontWeight:700}}>
        Sources ({m.sources.length}) — retrieved curriculum vs suggestions
       </summary>
       {m.sources.map((s,i)=>{const kind=sourceKind(s);return <div className="src" key={i}>
        {kind.retrieved?<IconCheck size={12}/>:<IconAlert size={12}/>}
        <span><b>[{i+1}] {s.title||'Source'}</b>
         {s.org?<span style={{color:'var(--faint)'}}> — {s.org}</span>:''}
         <span style={{marginLeft:6,fontWeight:700,color:kind.retrieved?'var(--forest-deep)':'var(--honey-deep)'}}>{kind.label}</span>
         {s.url&&<a href={s.url} target="_blank" rel="noreferrer" style={{marginLeft:4}}>Open source ↗</a>}
        </span></div>})}
      </details>}
     {m.role==='thrive'&&m.id>hello[0].id&&<div className="reply-actions no-print" aria-label="Actions for this reply">
      <button className="btn btn-small" onClick={()=>{copyText(m.text);toast('Copied')}}><IconCopy size={12}/> Copy</button>
      <button className="btn btn-small" onClick={()=>{downloadText('thrive-chat.txt',m.text);toast('Exported')}}><IconDownload size={12}/> Export</button>
      <button className="btn btn-small" onClick={()=>saveDraft(m)}><IconSave size={12}/> {m.draft||m.savedId?'Saved':'Save'}</button>
      <button className="btn btn-small" onClick={()=>share(m)} title="Share this reply on WhatsApp"><IconLink size={12}/> WhatsApp</button>
     </div>}
     {m.ts&&<small style={{display:'block',fontSize:8,opacity:.6,marginTop:5}}>{m.ts}</small>}
    </div>)}
    {busy&&<div className="bubble" aria-live="polite">THRIVE is thinking…</div>}
   </section>

   <aside className="wa-card">
    <div className="wa-head">
     <span className="wa-logo">✆</span>
     <div><b style={{fontFamily:"'Fraunces'",fontSize:14}}>THRIVE on chat</b><small style={{display:'block',color:'var(--muted)',fontSize:10.5}}>One assistant, WhatsApp-style thread</small></div>
    </div>
    <div className="channel-row"><span className="channel-dot" style={{background:'var(--forest)'}}/><span><b>Web chat</b><small>Live — this thread, works signed in or out</small></span></div>
    <div className="channel-row"><span className="channel-dot" style={{background:'var(--honey)'}}/><span><b>Voice notes</b><small>{!mounted?'Voice input':speechSupported()?'Tap the mic below and speak':'Not available in this browser — use Chrome or Edge'}</small></span></div>
    <div className="channel-row"><span className="channel-dot" style={{background:waStatus?.live?'var(--forest)':'var(--muted)'}}/>
     <span><b>WhatsApp bot</b><small>{waStatus? (waStatus.live
      ? 'Live — Meta credentials configured, sending to real phones'
      : 'Connected and replying here — messages reach real phones once a WhatsApp Business number is added')
      : 'Checking integration status…'}</small></span></div>
    <div className="divider"/>
    <b style={{fontFamily:"'Fraunces'",fontSize:13}}>Try asking</b>
    <div style={{display:'grid',gap:7,marginTop:9}}>{QUICK.map(q=><button className="btn" style={{textAlign:'left',lineHeight:1.5,justifyContent:'flex-start',fontSize:11}} onClick={()=>send(q)} key={q}>{q}</button>)}</div>
    <div className="divider"/>
    <div className="notice">Replies use THRIVE's curriculum references and your teaching context. Confirm syllabus-specific claims against your official curriculum.</div>
   </aside>
  </div>

  <div className="panel" style={{marginTop:15}}>
   <div className="chat-input" style={{borderTop:0,paddingTop:0,marginTop:0}}>
    <button className={'mic-btn'+(voice==='listening'?' live':'')} onClick={toggleMic}
      aria-label={voice==='listening'?'Stop voice input':'Speak your message'} title="Speak your message">
     {voice==='listening'?'■':'●'}
    </button>
    <input className="input" value={text} onChange={e=>setText(e.target.value)}
      onKeyDown={e=>{
       // Don't submit mid-IME composition (Hindi/Japanese input).
       if(e.key==='Enter'&&!e.nativeEvent.isComposing)send()
      }}
      placeholder={voice==='listening'?'Listening…':'Type a message, or tap the mic to speak…'}/>
    <button className="btn btn-primary" onClick={()=>send()} disabled={busy}>Send ↑</button>
   </div>
   {voice==='listening'&&<div className="voice-status" aria-live="polite">Listening — speak now.</div>}
   {voice==='unsupported'&&<div className="voice-status" role="alert">Voice input is not available in this browser. Type instead, or open THRIVE in Chrome or Edge.</div>}
   {heard&&voice==='idle'&&<div className="voice-status idle" aria-live="polite">Heard: “{heard}” — edit before sending if anything was misheard.</div>}
  </div>

  <section className="panel" style={{marginTop:15}}>
   <div className="panel-title"><div><h2>Connect this assistant to WhatsApp</h2><p>One assistant answers every channel — web chat already uses it</p></div></div>
   <div className="plan-list">
    <div className="plan-item"><span className="plan-icon">1</span><span><b>The assistant is already live here</b><small>Messages sent in this chat are answered by the same assistant the WhatsApp bot will use.</small></span></div>
    <div className="plan-item"><span className="plan-icon">2</span><span><b>Get a WhatsApp Business number</b><small>Your school or programme verifies a business number and requests an access token from Meta.</small></span></div>
    <div className="plan-item"><span className="plan-icon">3</span><span><b>Connect it in admin settings</b><small>Once credentials are added, the same replies start arriving on teachers' phones — nothing else to rebuild.</small></span></div>
   </div>
   <div className="notice" style={{marginTop:12}}>Until a business number is connected, this web chat is the way to use the assistant — no messages are sent to any phone.</div>
  </section>
 </Layout>
}
