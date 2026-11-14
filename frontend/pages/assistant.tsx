import {useEffect,useRef,useState} from 'react'
import Link from 'next/link'
import Layout from '../components/Layout'
import {useStoredState, EMPTY_PROFILE} from '../lib/storage'
import {api,getToken,ApiError} from '../lib/api'
import {ensureGuest,guestHeaders,guestErrorMessage} from '../lib/guest'
import {findFallback} from '../lib/demo-fallback'
import {savePlan} from '../lib/plans'
import {IllEmpty} from '../components/Illustrations'
import {createRecognizer,speechSupported,VoiceState} from '../lib/voice'
import {
 IconAlert,IconCheck,IconClipboard,IconCopy,IconDownload,IconExternal,
 IconLayers,IconLink,IconSave,IconSparkle,IconX,
} from '../components/Icons'

type Source={title?:string;org?:string;url?:string;why?:string}
/* A failed assistant turn. `failed` carries the question so the bubble can
   offer Retry; `fallback` marks a pre-written sample answer (not live). */
type Failure={question:string;message:string}
type FallbackInfo={sample:true}
/* plan: the compiled schedule when the reply IS a lesson plan (server-built).
   draft:true marks the reply as a saved draft, not yet compiled. */
type Message={
 id:number;role:'teacher'|'assistant';text:string;sources?:Source[];mode?:string
 plan?:any;planId?:number|string;draft?:boolean
 /* set on an assistant bubble that failed; enables its Retry button */
 failed?:Failure
 /* true when the text is a pre-written sample, shown because the live
    assistant was unreachable — the bubble labels it "sample" */
 sample?:boolean
}

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
 if(mode==='sample')return {cls:'local',text:'Sample (pre-written)'}
 return {cls:'grounded',text:'Grounded'}
}

/* Distinguish retrieved corpus sources from the engine's own suggestions. */
function sourceKind(s:Source){
 const why=(s.why||'').toLowerCase()
 if(why.includes('matched')||why.includes('retrieved'))return {label:'Retrieved',retrieved:true}
 if(why.includes('fallback')||why.includes('pattern')||why.includes('general pedagogy'))return {label:'Suggestion',retrieved:false}
 if(why.includes('no account')||why.includes('notice')||why.includes('connection'))return {label:'Notice',retrieved:false}
 return {label:'Reference',retrieved:false}
}

/* ── reply → plan helpers ───────────────────────────────────────────
   The compiled schedule arrives as `plan` (server-built). For messages
   fetched from history (no plan field) we parse the reply text — header
   "Subject · N minutes · Grades a, b" + slot lines — into a draft so
   "Open in Curriculum Studio" always has real inputs to hydrate. Never
   fabricated: if neither source exists, the action is simply not offered. */

function parsePlanReply(text:string){
 const lines=text.split('\n')
 const head=lines[0]?.match(/^(.+?) · (\d+) minutes · Grades ([\d,\s&]+)$/)
 if(!head)return null
 const subject=head[1].trim(),minutes=Number(head[2])
 const grades=Array.from(new Set(head[3].split(/[,\s&]+/).filter(Boolean))).map(g=>({grade:g,topic:'',objective:'',shared:''}))
 if(!grades.length||!minutes)return null
 const schedule:any[]=[]
 for(const ln of lines){
  const m=ln.match(/^(\d{1,2}):(\d{2})[–-](\d{1,2}):(\d{2})\s+(.+)$/)
  if(!m)continue
  const start=Number(m[1])*60+Number(m[2]),end=Number(m[3])*60+Number(m[4])
  const label=m[5].trim()
  const kind=/opening/i.test(label)?'opening':/closing/i.test(label)?'closing'
   :/transition/i.test(label)?'transition':'turn'
  const focus=(label.match(/Grade\s*\d+/i)||['All grades'])[0]
  schedule.push({start,end,kind,focus,grades:grades.map(g=>`Grade ${g.grade}`),
   objective:'',teacher:kind==='turn'?'You (teacher)':'Whole class',
   activity:label,materials:'',check:''})
 }
 return {subject,minutes,grades,schedule}
}

async function copyText(t:string){
 try{await navigator.clipboard.writeText(t);return true}
 catch{ // clipboard blocked (http origin / permissions) — visible fallback
  const ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0'
  document.body.appendChild(ta);ta.select();try{document.execCommand('copy')}catch{}finally{ta.remove()}
  return true
 }
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

export default function Assistant(){
 const [messages,setMessages]=useStoredState<Message[]>('assistant-messages',start)
 const [profile]=useStoredState<any>('profile',EMPTY_PROFILE)
 const [plans,setPlans]=useStoredState<any[]>('plans',[])
 const [text,setText]=useState(''),[language,setLanguage]=useState(profile.language||'English'),[busy,setBusy]=useState(false),[offline,setOffline]=useState(false)

 // Keep the reply language in step with the teacher's saved preference.
 useEffect(()=>{if(profile.language&&profile.language!==language&&language==='English')setLanguage(profile.language)},[profile.language])
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
    // Name the actual cause (502 = backend unreachable, 429 = quota) rather
    // than a blanket "check your connection".
    setMessages([...next,failureBubble(q.trim(),guestErrorMessage())])
    setBusy(false);return
   }
   try{
    // Guest asks carry the same teaching context as signed-in chat, so the
    // engine can ground replies in the teacher's state/board/grades.
    const ctx={
     state:profile.state,board:profile.board,medium:profile.medium,
     grades:profile.grades,subjects:profile.subjects,
    }
    const r=await api.post<any>('/api/guest/ask',{message:q.trim(),language,context:ctx},guestHeaders())
    setMessages(m=>[...m,{id:Date.now()+1,role:'assistant',text:r.reply,sources:r.sources||[],mode:r.mode,plan:r.plan||undefined}])
    setOffline(false)
   }catch(err:any){
    const limited=err instanceof ApiError&&(err.status===401||err.status===429)
    const msg=limited?err.message:`I could not reach THRIVE right now (${err?.message||'please try again in a moment'}).`
    setMessages(m=>[...m,failureBubble(q.trim(),msg)])
    setOffline(!limited)
   }finally{setBusy(false)}
   return
  }
  // Signed-in: persisted chat with account history.
  try{
   const r=await api.post<any>('/api/assistant/chat',{message:q.trim(),language})
   setMessages(m=>[...m,{id:Date.now()+1,role:'assistant',text:r.reply,sources:r.sources||[],mode:r.mode,plan:r.plan||undefined}])
   setOffline(false)
  }catch(err:any){
   setMessages(m=>[...m,failureBubble(q.trim(),
    `I could not reach THRIVE right now (${err?.message||'please try again in a moment'}).`)])
   setOffline(true)
  }finally{setBusy(false)}
 }

 /* A failed turn. When we have a pre-written answer for this question we
    show it immediately, clearly tagged "sample", plus a Retry — so a live
    demo never ends on an error. Same handler for guest and signed-in paths. */
 function failureBubble(question:string,message:string):Message{
  const fb=findFallback(question,language)
  if(fb)return{id:Date.now()+2,role:'assistant',text:fb.text,sources:fb.sources,mode:'sample',sample:true}
  return{id:Date.now()+2,role:'assistant',text:message,
   sources:[{title:'Service notice',org:'THRIVE',why:'connection notice'}],
   mode:'local-grounded',failed:{question,message}}
 }

 /** Retry a failed question: drop the failure bubble and ask again. */
 function retry(f:Failure,id:number){
  setMessages(ms=>ms.filter(m=>m.id!==id))
  send(f.question)
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

 /* ── per-reply actions ─────────────────────────────────────────── */

 function update(id:number,patch:Partial<Message>){
  setMessages(ms=>ms.map(m=>m.id===id?{...m,...patch}:m))
 }

 async function copyReply(m:Message){
  await copyText(m.text);toast('Reply copied')
 }
 function exportReply(m:Message){
  const prev=messages.find(x=>x.id<m.id&&x.role==='teacher')
  const body=[prev?`Q: ${prev.text}`:'',m.text,'',
   ...(m.sources||[]).map((s,i)=>`[${i+1}] ${s.title||'Source'}${s.org?` — ${s.org}`:''}${s.why?` (${s.why})`:''}`)].join('\n')
  downloadText(`thrive-reply-${new Date().toISOString().slice(0,10)}.txt`,body)
  toast('Exported as a text file')
 }

 /* Save the reply as a plan draft in My resources — a real PlanItem the
    resources page and studio can both read (draft text kept verbatim). */
 async function saveDraft(m:Message){
  const parsed=m.plan?null:parsePlanReply(m.text)
  const head=(parsed||m.plan&&{subject:m.plan.subject,minutes:m.plan.minutes})
  const subject=(head as any)?.subject||profile.subjects?.split(',')[0]||'Classroom note'
  const minutes=Number((head as any)?.minutes)||40
  const title=`${subject} — assistant reply`
  const item={
   title,subject,medium:profile.medium||'',board:profile.board||'',minutes,
   grades:m.plan?.inputs?.grades?.map((g:string)=>({grade:String(g),topic:'',objective:'',shared:''}))
    ||parsed?.grades||[],
   schedule:m.plan?.slots||parsed?.schedule||[],
   assessments:m.plan?.assessments||[],
   sources:m.sources||[],
   draft:m.text,
   savedAt:new Date().toISOString(),
  }
  const stored=await savePlan(item as any)
  setPlans([stored,...plans.filter(p=>String(p.id)!==String(stored.id))])
  update(m.id,{planId:stored.id,draft:true})
  toast('Saved to My resources as a draft')
 }

 /* Convert the reply into an editable lesson plan and open it in the
    Curriculum Studio. Uses the server's compiled schedule when present,
    else parses the reply header/slots into real inputs. */
 async function openInStudio(m:Message){
  const compiled=m.plan
  const parsed=compiled?null:parsePlanReply(m.text)
  if(!compiled&&!parsed){
   toast('This reply has no schedule to open — ask for a lesson plan first')
   return
  }
  const inputs=compiled?.inputs||{}
  const grades=compiled
   ? (inputs.grades||[]).map((g:string)=>({grade:String(g),topic:inputs.topics?.[String(g)]||'',objective:'',shared:''}))
   : parsed!.grades
  const item:any={
   title:`${compiled?compiled.subject||inputs.subject||'Lesson plan':parsed!.subject}: ${grades.map((g:any)=>`Grade ${g.grade}`).join(' & ')}`,
   subject:compiled?compiled.subject||inputs.subject||'Mathematics':parsed!.subject,
   medium:profile.medium||'',board:profile.board||'',
   minutes:compiled?inputs.minutes||compiled.slots?.at?.(-1)?.end||45:parsed!.minutes,
   grades,
   schedule:compiled?.slots||parsed!.schedule||[],
   assessments:compiled?.assessments||[],
   sources:compiled?.sources||m.sources||[],
   savedAt:new Date().toISOString(),
  }
  const stored=await savePlan(item)
  setPlans([stored,...plans.filter(p=>String(p.id)!==String(stored.id))])
  update(m.id,{planId:stored.id})
  sessionStorage.setItem('thrive:openPlan',JSON.stringify(stored))
  window.location.href=`/compiler?open=${encodeURIComponent(String(stored.id))}`
 }

 function worksheet(m:Message){
  const prev=messages.find(x=>x.id<m.id&&x.role==='teacher')
  const title=prev?`Worksheet: ${prev.text.slice(0,60)}`:'Practice worksheet'
  const body=[title,'='+'='.repeat(Math.min(title.length,60)),'',
   'Name: __________________  Grade: ______  Date: __________','',
   m.text,'',
   'Instructions: attempt every question, then check your answers with a partner.','',
   `Generated from THRIVE on ${new Date().toLocaleDateString()} — review before class.`].join('\n')
  downloadText('thrive-worksheet.txt',body)
  toast('Worksheet exported — edit it before photocopying')
 }

 function shareOnWhatsApp(m:Message){
  const prev=messages.find(x=>x.id<m.id&&x.role==='teacher')
  const msg=prev?`${prev.text}\n\n${m.text}`:m.text
  window.open('https://wa.me/?text='+encodeURIComponent(msg.slice(0,1800)),'_blank','noopener')
 }

 /* Hand this reply to the quick chat thread (chat.tsx shows a banner). */
 function sendToChat(m:Message){
  const prev=messages.find(x=>x.id<m.id&&x.role==='teacher')
  sessionStorage.setItem('thrive:appContext',JSON.stringify({
   from:'assistant',title:prev?prev.text.slice(0,90):'From the teaching assistant',
   reply:m.text,sources:m.sources||[],ts:Date.now(),
  }))
  window.location.href='/chat'
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
   <div style={{display:'flex',gap:8,alignItems:'flex-end',flexWrap:'wrap'}}>
    <Link href="/chat" className="btn btn-small" title="Open the WhatsApp-style quick chat">Open quick chat</Link>
    <div className="field" style={{margin:0,minWidth:125}}><label>Response language</label><select value={language} onChange={e=>setLanguage(e.target.value)}><option>English</option><option>Hindi</option></select></div>
   </div>
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
      {m.sample&&<div className="notice" style={{marginBottom:8,padding:'6px 9px',fontSize:10.5}}
        title="The live assistant could not be reached, so a pre-written answer is shown instead.">
        <b>Sample answer</b> — the live assistant was unreachable. This is pre-written guidance, not a live grounded reply.
      </div>}
      <div style={{whiteSpace:'pre-line'}}>{m.text}</div>
      {m.failed&&<div style={{marginTop:8}}>
        <button className="btn btn-small btn-primary" onClick={()=>retry(m.failed!,m.id)}>
          <IconSparkle size={12}/> Retry
        </button>
      </div>}
      {m.role==='assistant'&&modeLabel(m.mode)&&<div style={{marginTop:6}}>
        <span className={'mode-badge '+modeLabel(m.mode)!.cls}>{modeLabel(m.mode)!.text}</span>
        {m.plan&&<span className="mode-badge grounded" style={{marginLeft:6}}>Compiled schedule</span>}
      </div>}
      {m.role==='assistant'&&m.plan&&<div className="notice" style={{marginTop:8,padding:'7px 9px',fontSize:10.5}}>
       This reply contains a compiled multi-grade schedule.
       <button className="btn btn-small" style={{marginLeft:8}} onClick={()=>openInStudio(m)}>
        <IconLayers size={12}/> Open in Curriculum Studio</button>
      </div>}
      {m.role==='assistant'&&m.sources&&m.sources.length>0?
       <details className="sources-box">
        <summary style={{cursor:'pointer',fontSize:10,fontWeight:700}}>
         Sources ({m.sources.length}) — retrieved curriculum vs suggestions
        </summary>
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
       </details>
      :null}
      {m.role==='assistant'&&m.id>start[0].id&&<div className="reply-actions no-print" aria-label="Actions for this reply">
       <button className="btn btn-small" onClick={()=>copyReply(m)}><IconCopy size={12}/> Copy</button>
       <button className="btn btn-small" onClick={()=>exportReply(m)}><IconDownload size={12}/> Export</button>
       <button className="btn btn-small" onClick={()=>saveDraft(m)} title="Save this reply to My resources">
        <IconSave size={12}/> {m.planId||m.draft?'Saved':'Save'}</button>
       {(m.plan||parsePlanReply(m.text))&&<button className="btn btn-small btn-primary" onClick={()=>openInStudio(m)}>
        <IconLayers size={12}/> Open as lesson plan</button>}
       <button className="btn btn-small" onClick={()=>worksheet(m)} title="Download a practice worksheet based on this reply">
        <IconClipboard size={12}/> Worksheet</button>
       <button className="btn btn-small" onClick={()=>shareOnWhatsApp(m)} title="Share on WhatsApp">
        <IconLink size={12}/> WhatsApp</button>
       <button className="btn btn-small" onClick={()=>sendToChat(m)} title="Continue this in the quick chat">
        <IconLink size={12}/> Quick chat</button>
      </div>}
     </div>)}
     {busy&&<div className="bubble" aria-live="polite">Retrieving sources and drafting a practical suggestion…</div>}
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
     <input className="input" value={text} onChange={e=>setText(e.target.value)}
       onKeyDown={e=>{
        // Don't submit mid-IME composition (Hindi/Japanese input).
        if(e.key==='Enter'&&!e.nativeEvent.isComposing)send()
       }}
       placeholder={voice==='listening'?'Listening… speak in '+(language==='Hindi'?'Hindi':'English'):'Ask about a lesson, activity or classroom challenge…'}/>
     <button className="btn btn-primary" onClick={()=>send()} disabled={busy}>Send ↑</button>
    </div>
    {voice==='listening'&&<div className="voice-status" aria-live="polite">Listening — speak now, then tap the mic again if it keeps recording.</div>}
    {voice==='unsupported'&&<div className="voice-status" role="alert">Voice input is not available in this browser. Type your question instead, or open THRIVE in Chrome or Edge.</div>}
    {heard&&voice==='idle'&&<div className="voice-status idle" aria-live="polite">Heard: “{heard}” — edit the text before sending if anything was misheard.</div>}
    <div style={{fontSize:9,color:'var(--muted)',marginTop:7,lineHeight:1.6}}>{offline?'THRIVE is unreachable right now — your questions stay in this conversation and you can retry in a moment.':'Retrieved sources are from THRIVE’s curriculum corpus; suggestions and pattern replies are labelled as such — they are not curriculum facts.'}</div>
   </section>
   <aside className="panel">
    <div className="panel-title"><div><h2>Try asking</h2><p>Start with a classroom situation</p></div></div>
    <div style={{display:'grid',gap:8}}>{SUGGESTIONS.map(q=><button className="btn" style={{textAlign:'left',lineHeight:1.5,justifyContent:'flex-start'}} onClick={()=>send(q)} key={q}>{q}</button>)}</div>
    <div className="divider"/>
    <div style={{fontSize:10,fontWeight:700,marginBottom:7}}>After any reply</div>
    <div className="muted" style={{fontSize:9.5,lineHeight:1.7,marginBottom:10}}>
     Six follow-up chips sit under the latest answer (simplify, adapt, worksheet, aid, assessment, alternative).
     Every reply also offers Copy, Export, Save, Open as lesson plan, Worksheet, WhatsApp and Quick chat actions below it.
     Lesson-plan replies open straight in Curriculum Studio.</div>
    <div className="notice">The assistant never replaces your professional judgement. Confirm curriculum-specific claims against your current official syllabus; THRIVE's curriculum references cover Grades 1–5 core chapters only.</div>
   </aside>
  </div>
 </Layout>
}
