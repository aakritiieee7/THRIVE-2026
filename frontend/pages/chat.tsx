import {useEffect,useRef,useState} from 'react'
import Layout from '../components/Layout'
import {useStoredState} from '../lib/storage'
import {api,getToken} from '../lib/api'
import {createRecognizer,speechSupported,VoiceState} from '../lib/voice'
import {IconAlert,IconCheck} from '../components/Icons'

type Source={title?:string;org?:string;url?:string;why?:string}
type Msg={id:number;role:'teacher'|'thrive';text:string;ts:string;sources?:Source[];mode?:string}

const hello:Msg[]=[{id:1,role:'thrive',
 text:'Namaste. This is THRIVE chat — the same assistant that lives in Teaching assistant, shaped for quick messages like WhatsApp. Ask about a lesson, an activity, or a classroom challenge.',
 ts:''}]

const QUICK=[
 'How do I teach fractions to Grade 4 and Grade 2 in one period?',
 'Suggest a reading activity with only chalk and paper.',
 'What is a good 5-minute check for understanding?',
 'How do I settle a noisy class without shouting?'
]

export default function Chat(){
 const [msgs,setMsgs]=useStoredState<Msg[]>('chat-messages',hello)
 const [profile]=useStoredState<any>('profile',{state:'Bihar',grades:'3, 5',subjects:'Mathematics'})
 const [text,setText]=useState(''),[language,setLanguage]=useState('English')
 const [busy,setBusy]=useState(false),[voice,setVoice]=useState<VoiceState>('idle')
 const [heard,setHeard]=useState('')
 const [waStatus,setWaStatus]=useState<any>(null)
 const [mounted,setMounted]=useState(false)
 const scroller=useRef<HTMLDivElement>(null)
 const recRef=useRef<ReturnType<typeof createRecognizer>|null>(null)

 // speechSupported() reads window, so it is false on the server and true in
 // a capable browser — render it only after mount or hydration mismatches.
 useEffect(()=>{setMounted(true)},[])
 useEffect(()=>{api.get<any>('/api/assistant/whatsapp/status').then(setWaStatus).catch(()=>setWaStatus(null))},[])

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
   let reply:string,sources:Source[]=[],mode:string|undefined
   if(getToken()){
    const r=await api.post<any>('/api/assistant/chat',{message:mine.text,language})
    reply=r.reply;sources=r.sources||[];mode=r.mode
   }else{
    const r=await api.post<any>('/api/assistant/bridge',{
     channel:'webchat',from:'web-visitor',message:mine.text,language,
     profile:{state:profile.state,grades:profile.grades,subjects:profile.subjects}
    })
    reply=r.reply;sources=r.sources||[];mode=r.mode
   }
   setMsgs(m=>[...m,{id:Date.now()+1,role:'thrive',text:reply,sources,mode,ts:''}])
  }catch(err:any){
   setMsgs(m=>[...m,{id:Date.now()+1,role:'thrive',ts:'',
    text:`I could not reach THRIVE right now (${err?.message||'network error'}). Your message is saved here — try again in a moment.`}])
  }finally{setBusy(false)}
 }

 return <Layout title="Chat with THRIVE">
  <div className="page-heading"><div><div className="eyebrow">Chat with THRIVE</div><h1>Message THRIVE the way you message anyone.</h1><p>A WhatsApp-style thread backed by the same grounded assistant — type, speak, or connect your phone.</p></div>
   <div className="field" style={{margin:0,minWidth:125}}><label>Reply language</label><select value={language} onChange={e=>setLanguage(e.target.value)}><option>English</option><option>Hindi</option></select></div>
  </div>

  <div className="chat-shell">
   <section className="chat-stage" ref={scroller}>
    {msgs.map(m=><div className={'bubble '+(m.role==='teacher'?'mine':'')} key={m.id}>
     <div style={{whiteSpace:'pre-line'}}>{m.text}</div>
     {m.role==='thrive'&&m.mode&&<div style={{marginTop:6}}>
      <span className={'mode-badge '+
       (m.mode==='llm-grounded'?'llm':m.mode==='local-grounded'?'local':'grounded')}>
       {m.mode==='llm-grounded'?'Grounded · AI-drafted':m.mode==='local-grounded'?'Pattern guidance':'Grounded'}
      </span>
     </div>}
     {m.sources&&m.sources.length>0&&<div className="sources-box">
      {m.sources.map((s,i)=>{const retrieved=/matched|retrieved/i.test(s.why||'');return <div className="src" key={i}>
       {retrieved?<IconCheck size={12}/>:<IconAlert size={12}/>}
       <span><b>[{i+1}] {s.title||'Source'}</b>
        {s.org?<span style={{color:'var(--faint)'}}> — {s.org}</span>:''}
        <span style={{marginLeft:6,fontWeight:700,color:retrieved?'var(--forest-deep)':'var(--honey-deep)'}}>
         {retrieved?'Retrieved':'Suggestion'}</span>
        {s.url&&<a href={s.url} target="_blank" rel="noreferrer" style={{marginLeft:4}}>Open source ↗</a>}
       </span></div>})}
     </div>}
     {m.ts&&<small style={{display:'block',fontSize:8,opacity:.6,marginTop:5}}>{m.ts}</small>}
    </div>)}
    {busy&&<div className="bubble">THRIVE is thinking…</div>}
   </section>

   <aside className="wa-card">
    <div className="wa-head">
     <span className="wa-logo">✆</span>
     <div><b style={{fontFamily:"'Fraunces'",fontSize:14}}>THRIVE on chat</b><small style={{display:'block',color:'var(--muted)',fontSize:10.5}}>Web chat now · WhatsApp bot next</small></div>
    </div>
    <div className="channel-row"><span className="channel-dot" style={{background:'var(--forest)'}}/><span><b>Web chat</b><small>Live — this thread, works signed in or out</small></span></div>
    <div className="channel-row"><span className="channel-dot" style={{background:'var(--honey)'}}/><span><b>Voice notes</b><small>{!mounted?'Voice input':speechSupported()?'Tap the mic below and speak':'Not available in this browser — use Chrome or Edge'}</small></span></div>
    <div className="channel-row"><span className="channel-dot" style={{background:waStatus?.live?'var(--forest)':'var(--muted)'}}/>
     <span><b>WhatsApp bot</b><small>{waStatus? (waStatus.live
      ? 'Live — Meta credentials configured, outbound sends enabled'
      : 'Local simulation — webhook + chatbot built; add WHATSAPP_TOKEN/WHATSAPP_PHONE_ID to send real messages (see README)')
      : 'Checking integration status…'}</small></span></div>
    <div className="divider"/>
    <b style={{fontFamily:"'Fraunces'",fontSize:13}}>Try asking</b>
    <div style={{display:'grid',gap:7,marginTop:9}}>{QUICK.map(q=><button className="btn" style={{textAlign:'left',lineHeight:1.5,justifyContent:'flex-start',fontSize:11}} onClick={()=>send(q)} key={q}>{q}</button>)}</div>
    <div className="divider"/>
    <div className="notice">Replies use THRIVE's curriculum corpus and your teaching context. Confirm syllabus-specific claims against your official curriculum.</div>
   </aside>
  </div>

  <div className="panel" style={{marginTop:15}}>
   <div className="chat-input" style={{borderTop:0,paddingTop:0,marginTop:0}}>
    <button className={'mic-btn'+(voice==='listening'?' live':'')} onClick={toggleMic}
      aria-label={voice==='listening'?'Stop voice input':'Speak your message'} title="Speak your message">
     {voice==='listening'?'■':'●'}
    </button>
    <input className="input" value={text} onChange={e=>setText(e.target.value)}
      onKeyDown={e=>e.key==='Enter'&&send()}
      placeholder={voice==='listening'?'Listening…':'Type a message, or tap the mic to speak…'}/>
    <button className="btn btn-primary" onClick={()=>send()} disabled={busy}>Send ↑</button>
   </div>
   {voice==='listening'&&<div className="voice-status">Listening — speak now.</div>}
   {voice==='unsupported'&&<div className="voice-status">Voice input is not available in this browser. Type instead, or open THRIVE in Chrome or Edge.</div>}
   {heard&&voice==='idle'&&<div className="voice-status idle">Heard: “{heard}” — edit before sending if anything was misheard.</div>}
  </div>

  <section className="panel" style={{marginTop:15}}>
   <div className="panel-title"><div><h2>Connect this assistant to WhatsApp</h2><p>One bridge serves every channel — web chat already uses it</p></div></div>
   <div className="plan-list">
    <div className="plan-item"><span className="plan-icon">1</span><span><b>Backend bridge is running</b><small>POST /api/assistant/bridge answers any channel: WhatsApp, SMS or this chat.</small></span></div>
    <div className="plan-item"><span className="plan-icon">2</span><span><b>Create a Meta WhatsApp app</b><small>Add the WhatsApp product, verify your number, and get an access token.</small></span></div>
    <div className="plan-item"><span className="plan-icon">3</span><span><b>Point the webhook at THRIVE</b><small>Set the webhook URL to your deployment's /api/assistant/whatsapp with the verify token.</small></span></div>
   </div>
   <div className="notice" style={{marginTop:12}}>Until Meta credentials are added, this web chat exercises the exact same bridge the WhatsApp bot will use — so the flow is proven end to end before a number goes live.</div>
  </section>
 </Layout>
}
