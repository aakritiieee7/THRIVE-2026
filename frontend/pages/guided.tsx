import {useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import Layout from '../components/Layout'
import {useStoredState} from '../lib/storage'
import {api,getToken} from '../lib/api'
import {fetchChapters,matchChapter,SHARED_TOPICS,SubjectChapters} from '../lib/curriculum'
import {IconCheck,IconClock} from '../components/Icons'

/**
 * Guided Setup — a five-stage walkthrough for a first-time teacher.
 * Each stage answers: why this stage matters, what to do (with a
 * pre-filled worked example), and what "done" looks like. Stage 5 runs
 * the real constraint compiler and renders the plan as a stage-by-stage
 * timeline so the teacher can see what happens at every minute.
 */

type GradePlan={grade:string;topic:string;objective:string;shared:string}
type Lane={who:string;doing:string;is_teacher?:string}
type Slot={start:number;end:number;focus:string;grades:string[];objective:string;teacher:string;activity:string;materials:string;check:string;kind:string;lanes?:Lane[];early_finishers?:string}
type PlanResult={slots:Slot[];assessments:{grade:string;prompt:string;follow_up:string}[];engine:string;sources:{kind:string;note:string}[]}

const STAGES=[
 {n:1,short:'Your context',title:'Set your teaching context',hint:'State, board, medium'},
 {n:2,short:'Your room',title:'Describe the classroom',hint:'Grades in the room'},
 {n:3,short:"Today's goal",title:"Pick today's learning goal",hint:'Topic + outcome'},
 {n:4,short:'Check it',title:'Check feasibility',hint:'Minutes vs. groups'},
 {n:5,short:'Run & review',title:'Generate and review',hint:'Timeline + save'},
]

const EXAMPLE_SUBJECTS=['Mathematics','Environmental Studies','Language','Science','Social Science']
const fmt=(n:number)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`

/* What the teacher gains at each stage — the "why" narration. */
const WHY=[
 <><b>Why this first:</b> THRIVE tailors every suggestion — assistant replies, topic lists, training — to your board and medium. This stays on your device until you sign in, and you can change it any time from My profile.</>,
 <><b>Why this matters:</b> A multi-grade room is ONE system, not separate classes. The compiler needs to know every group in the room so no grade waits without a task while you teach another.</>,
 <><b>Worked example:</b> You are teaching Grades 3 and 5 Mathematics today. Grade 3 is starting <i>Shapes and Patterns</i>; Grade 5 is working on <i>Fractions</i>. Pick the topic, then confirm the learning goal — THRIVE pre-fills it from NCERT learning outcomes, and you can edit it.</>,
 <><b>Why check first:</b> The engine will refuse to fake a schedule. Every group needs its own teacher-led turn (≥ 5 min) plus a shared opening and a closing check — better to see the maths before you commit the period.</>,
 <><b>What happens now:</b> THRIVE compiles ONE coordinated period: a shared opening, a teacher-led turn per grade (others do independent work), and a closing check — filling your minutes exactly. Review the timeline below, then save it to My resources.</>,
]

export default function Guided(){
 const [profile,setProfile]=useStoredState<any>('profile',{name:'',state:'Bihar',board:'Bihar SCERT',medium:'Hindi + English',grades:'3, 5',subjects:'Mathematics'})
 const [stage,setStage]=useState(1)
 const [subject,setSubject]=useState('Mathematics')
 const [minutes,setMinutes]=useState(45)
 const [materials,setMaterials]=useState('paper, chalk, classroom objects')
 const [buffer,setBuffer]=useState(0)
 const [grades,setGrades]=useState<GradePlan[]>([
  {grade:'3',topic:'Shapes and Patterns',objective:'Recognize and name common 2D shapes.',shared:''},
  {grade:'5',topic:'Fractions',objective:'Represent and compare simple fractions using paper folding.',shared:''},
 ])
 const [catalogs,setCatalogs]=useState<Record<string,SubjectChapters[]|null>>({})
 const [plan,setPlan]=useState<PlanResult|null>(null)
 const [error,setError]=useState(''),[busy,setBusy]=useState(false)
 const [savedPlans,setSavedPlans]=useStoredState<any[]>('plans',[])
 const [toast,setToast]=useState('')

 // keep grade chips in sync with profile the first time
 useEffect(()=>{
  if(profile.grades&&profile.grades.trim()){
   const list=profile.grades.split(',').map((g:string)=>g.trim()).filter(Boolean)
   if(list.length)setGrades(old=>old.length===2&&old.every(g=>!g.topic)?old.map((g,i)=>({...g,grade:list[i]??g.grade})):old)
  }
 },[])

 // curriculum catalogs for topic pickers
 useEffect(()=>{
  let live=true
  ;(async()=>{
   for(const g of grades){
    if(catalogs[g.grade]!==undefined)continue
    const data=await fetchChapters(g.grade,subject)
    if(live)setCatalogs(c=>({...c,[g.grade]:data}))
   }
  })()
  return ()=>{live=false}
 },[grades.map(g=>g.grade).join(','),subject])

 function setGrade(i:number,key:keyof GradePlan,value:string){setGrades(old=>old.map((g,n)=>n===i?{...g,[key]:value}:g))}

 function pickTopic(i:number,value:string){
  setGrade(i,'topic',value)
  const g=grades[i];const {chapter}=matchChapter(value,catalogs[g.grade])
  if(chapter&&value.trim().length>3){
   const first=chapter.learning_outcomes[0]?.text
   if(first)setGrade(i,'objective',first)
  }
 }

 const feasibility=useMemo(()=>{
  const n=grades.length
  const need=4+6+n*5+Math.max(0,n-1)*buffer  // opening + closing + turns + transitions
  const ok=minutes>=need&&n>=1&&n<=5&&grades.every(g=>g.grade.trim()&&g.topic.trim()&&g.objective.trim())
     &&new Set(grades.map(g=>g.grade.trim())).size===n
  return {n,need,ok,gap:need-minutes}
 },[grades,minutes,buffer])

 async function run(){
  setError('');setPlan(null)
  if(!feasibility.ok){setError('Fix the checks above before generating.');return}
  setBusy(true)
  try{
   const body={subject,medium:profile.medium||'English',board:profile.board||'NCERT',minutes,materials,transition_buffer:buffer,
    grades:grades.map(g=>({grade:g.grade,topic:g.topic,objective:g.objective,shared_group:g.shared||null}))}
   const r=await api.post('/api/compiler/run',body)
   setPlan(r as PlanResult)
  }catch(err:any){
   setError(err?.message||'Could not reach the compiler service. Make sure the backend is running and retry.')
  }finally{setBusy(false)}
 }

 async function save(){
  if(!plan)return
  // Persist the teaching context entered in Stage 1 to the account so the
  // assistant, compiler and home page all see the same profile.
  if(getToken()){
   try{
    await api.put('/api/auth/me',{name:profile.name,profile:{
     state:profile.state,board:profile.board,medium:profile.medium,
     grades:grades.map(g=>g.grade).join(', '),subjects:profile.subjects,
     language:profile.language||'English',school:profile.school||''}})
   }catch{}
  }
  const item={title:`${subject}: ${grades.map(g=>`Grade ${g.grade}`).join(' & ')}`,grades,minutes,subject,
   medium:profile.medium,board:profile.board,materials,schedule:plan.slots,assessments:plan.assessments,savedAt:new Date().toISOString()}
  try{
   const r=await api.post<any>('/api/plans',{title:item.title,subject,medium:item.medium,board:item.board,minutes,payload:item})
   setSavedPlans([{...item,id:r.id,server:true},...savedPlans])
  }catch{
   setSavedPlans([{...item,id:Date.now()},...savedPlans])
  }
  setToast('Saved to My resources');setTimeout(()=>setToast(''),2400)
 }

 const canAdvance=[true,true,grades.every(g=>g.topic.trim()&&g.objective.trim()),feasibility.ok,true]
 const go=(n:number)=>{
  // Leaving Stage 1 persists the teaching context to the account (when signed
  // in) so the assistant and compiler see it — local storage always has it.
  if(n>1&&stage===1&&getToken()){
   api.put('/api/auth/me',{name:profile.name,profile:{state:profile.state,board:profile.board,
    medium:profile.medium,grades:profile.grades,subjects:profile.subjects,
    language:profile.language||'English',school:profile.school||''}}).catch(()=>{})
  }
  if(n<=stage||canAdvance[n-2])setStage(n)
 }

 return <Layout title="Guided setup">
  <div className="page-heading"><div><div className="eyebrow">Guided setup · first lesson</div><h1>Plan your first lesson, stage by stage.</h1><p>A worked example runs alongside you — at every stage you'll see what to do and why.</p></div>
   <Link className="btn" href="/">← Back home</Link></div>

  <div className="guide-layout grid" style={{gridTemplateColumns:'242px minmax(0,1fr)',alignItems:'start'}}>
   <aside className="panel stepper" style={{display:'grid',gap:5}}>
    <div className="stepper-title">Your path</div>
    <div className="step-progress"><i style={{width:`${stage/5*100}%`}}/></div>
    {STAGES.map(s=>{
     const done=stage>s.n,active=stage===s.n,enabled=s.n<=stage||canAdvance[s.n-2]
     return <button key={s.n} className={'step-item '+(active?'active ':'')+(done?'done':'')} disabled={!enabled} onClick={()=>go(s.n)}>
      <span className="step-num">{done?'✓':s.n}</span>
      <span><b>{s.short}</b><small>{s.hint}</small></span>
     </button>
    })}
    <div className="divider" style={{margin:'6px 0'}}/>
    <div style={{padding:'0 10px 4px'}}>
     <div className="muted" style={{fontSize:9,lineHeight:1.6}}>Example: a Grade 3 + Grade 5 maths room, 45 minutes. Swap in your own details — the flow stays the same.</div>
    </div>
   </aside>

   <section className="panel">
    <div className="panel-title">
     <div><div className="eyebrow">Stage {stage} of 5</div><h2>{STAGES[stage-1].title}</h2></div>
     <span className="tag">≈ {stage<4?'1 min':stage===4?'30 sec':'2 min'}</span>
    </div>
    <div className="why">{WHY[stage-1]}</div>

    {/* ---------- Stage 1: teaching context ---------- */}
    {stage===1&&<div>
     <div className="form-grid">
      <div className="field"><label>State</label><select value={profile.state} onChange={e=>setProfile({...profile,state:e.target.value})}>{['Bihar','Delhi','Uttar Pradesh','Madhya Pradesh','Rajasthan','Other'].map(x=><option key={x}>{x}</option>)}</select></div>
      <div className="field"><label>Board / curriculum</label><select value={profile.board} onChange={e=>setProfile({...profile,board:e.target.value})}>{['Bihar SCERT','NCERT','State curriculum — other','Other'].map(x=><option key={x}>{x}</option>)}</select></div>
      <div className="field"><label>Medium of instruction</label><select value={profile.medium} onChange={e=>setProfile({...profile,medium:e.target.value})}>{['Hindi + English','Hindi','English','Other'].map(x=><option key={x}>{x}</option>)}</select></div>
      <div className="field"><label>Assistant reply language</label><select value={profile.language||'English'} onChange={e=>setProfile({...profile,language:e.target.value})}><option>English</option><option>Hindi</option></select></div>
     </div>
     <div className="notice" style={{marginTop:12}}><b>Example in this walkthrough:</b> Bihar · Bihar SCERT · Hindi + English — the same values you see pre-filled above.</div>
    </div>}

    {/* ---------- Stage 2: the room ---------- */}
    {stage===2&&<div>
     <div className="spread" style={{marginBottom:9}}>
      <div><b style={{fontSize:11}}>Grade groups in this room</b><div className="muted" style={{fontSize:9,marginTop:3}}>One row per group sharing this period. Topics come next.</div></div>
      <button className="btn btn-small" onClick={()=>grades.length<5&&setGrades([...grades,{grade:String(Math.max(...grades.map(g=>Number(g.grade)||0))+1),topic:'',objective:'',shared:''}])} disabled={grades.length>=5}>＋ Add grade</button>
     </div>
     <div className="grade-inputs">
      {grades.map((g,i)=><div className="grade-row" key={i} style={{gridTemplateColumns:'90px 1fr 1.1fr 30px'}}>
       <div className="field"><label>Grade</label><select value={g.grade} onChange={e=>setGrade(i,'grade',e.target.value)}>{Array.from({length:12},(_,n)=><option key={n+1}>{n+1}</option>)}</select></div>
       <div className="field"><label>Group label (what you call them)</label><input value={`Grade ${g.grade} group`} readOnly style={{background:'#f7f9f7'}}/></div>
       <div className="field"><label>Shared opening group</label>
        <select value={g.shared} onChange={e=>setGrade(i,'shared',e.target.value)}>
         <option value="">Taught separately</option>
         {SHARED_TOPICS.filter(s=>s.grades.includes(g.grade)).map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <small style={{fontSize:8.5,color:'var(--faint)',lineHeight:1.5}}>Grades share an opening only under the same group — each still gets its own turn.</small>
       </div>
       <button className="remove" aria-label="Remove grade" onClick={()=>grades.length>1&&setGrades(grades.filter((_,n)=>n!==i))}>×</button>
      </div>)}
     </div>
     {grades.some(g=>g.shared)&&<div className="match-note" style={{marginTop:10}}>
      {grades.filter(g=>g.shared).map(g=>`${SHARED_TOPICS.find(s=>s.key===g.shared)?.label||g.shared}: Grade ${g.grade}`).join(' · ')}
      {' — shared grades open together; each still gets its own teacher-led turn.'}
     </div>}
     <div className="notice" style={{marginTop:12}}><b>Example:</b> Grades 3 and 5 share one room. Neither group is ever left waiting — the plan you'll build in Stage 5 gives each a teacher-led turn while the other works independently.</div>
    </div>}

    {/* ---------- Stage 3: today's goal ---------- */}
    {stage===3&&<div>
     <div className="form-grid" style={{marginBottom:11}}>
      <div className="field"><label>Subject</label><select value={subject} onChange={e=>setSubject(e.target.value)}>{EXAMPLE_SUBJECTS.map(s=><option key={s}>{s}</option>)}</select></div>
      <div className="field"><label>Available class time (minutes)</label><input type="number" min="20" max="180" value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></div>
     </div>
     <div className="grade-inputs">
      {grades.map((g,i)=>{
       const {chapter}=matchChapter(g.topic,catalogs[g.grade])
       const outcomes=chapter?.learning_outcomes||[]
       return <div className="grade-row" key={i} style={{gridTemplateColumns:'64px 1fr 1.2fr'}}>
        <div className="field"><label>Grade</label><input value={g.grade} readOnly style={{background:'#f7f9f7'}}/></div>
        <div className="field"><label>Topic / chapter</label>
         <input list={`g-topics-${i}`} value={g.topic} onChange={e=>pickTopic(i,e.target.value)} placeholder="e.g. Shapes and Patterns"/>
         <datalist id={`g-topics-${i}`}>{(catalogs[g.grade]??[]).flatMap(s=>s.chapters.map(c=><option key={c.id} value={c.title}/>))}</datalist>
         {chapter&&<small style={{fontSize:8,color:'#6b8f77'}}>Curriculum match: {chapter.id}</small>}
        </div>
        <div className="field"><label>Learning goal</label>
         <input value={g.objective} onChange={e=>setGrade(i,'objective',e.target.value)} placeholder="What will learners do?"/>
         {outcomes.length>0&&<div className="outcome-chips">{outcomes.slice(0,3).map(o=><button type="button" className="outcome-chip" key={o.id} onClick={()=>setGrade(i,'objective',o.text)} title="Click to use this outcome">✓ {o.text}</button>)}</div>}
        </div>
       </div>})}
     </div>
     <div className="form-grid" style={{marginTop:12}}>
      <div className="field"><label>Materials in your classroom</label><input value={materials} onChange={e=>setMaterials(e.target.value)} placeholder="e.g. seeds, paper, chalk"/></div>
      <div className="field"><label>Transition time between groups (min)</label><input type="number" min="0" max="10" value={buffer} onChange={e=>setBuffer(Number(e.target.value))}/></div>
     </div>
     <div className="notice" style={{marginTop:12}}><b>Try it:</b> click a suggested outcome chip — it drops straight into the learning goal, so your plan speaks the curriculum's language.</div>
    </div>}

    {/* ---------- Stage 4: feasibility ---------- */}
    {stage===4&&<div>
     <div className={'minbar '+(feasibility.ok?'':'warn')}>
      <span>Needed: <b>{feasibility.need} min</b></span>
      <span className="bar"><i style={{width:`${Math.min(100,Math.round(minutes/Math.max(feasibility.need,minutes)*100))}%`}}/></span>
      <span>Yours: <b>{minutes} min</b></span>
     </div>
     <div className="check-list">
      <div className="check-item"><span className="check-ico">{feasibility.n>=1&&feasibility.n<=5?'✓':'!'}</span><div><b>Grade groups: {feasibility.n}</b>Between 1 and 5 groups per period are supported. Each needs its own teacher-led turn of at least 5 minutes.</div></div>
      <div className="check-item"><span className="check-ico">{new Set(grades.map(g=>g.grade.trim())).size===grades.length?'✓':'!'}</span><div><b>One turn per group</b>{new Set(grades.map(g=>g.grade.trim())).size===grades.length?'No group appears twice — attention is never double-booked.':'The same grade appears twice — each group may appear only once.'}</div></div>
      <div className="check-item"><span className="check-ico">{feasibility.ok?'✓':'!'}</span><div><b>Time budget</b>{feasibility.ok
       ?`${minutes} minutes covers the ${feasibility.need}-minute minimum (4 min opening + 6 min closing + 5 min per group${buffer?` + ${buffer} min transitions`:''}).`
       :`You need ${feasibility.need} minutes for ${feasibility.n} groups — raise the time to at least ${feasibility.need}, or remove a group.`}</div></div>
      <div className="check-item"><span className="check-ico">✓</span><div><b>Goals filled</b>{grades.every(g=>g.topic.trim()&&g.objective.trim())
       ?'Every group has a topic and a learning goal.':'Each group needs a topic and learning goal — go back to Stage 3.'}</div></div>
     </div>
     {!feasibility.ok&&<div className="notice" style={{background:'#fbefec',borderColor:'#f2d8d0',color:'#925e4d',marginTop:12}}>The engine refuses infeasible inputs instead of returning an attractive-but-unusable schedule. Fix the red checks above, then continue.</div>}
     {feasibility.ok&&<div className="notice" style={{marginTop:12}}><b>Ready:</b> the compiler will build ONE period that fills {minutes} minutes exactly — shared opening, a teacher-led turn per grade, closing check.</div>}
    </div>}

    {/* ---------- Stage 5: generate + timeline ---------- */}
    {stage===5&&<div>
     {!plan&&<div>
      {error&&<div className="notice" style={{background:'#fbefec',borderColor:'#f2d8d0',color:'#925e4d',marginBottom:12}}>{error}</div>}
      <button className="btn btn-primary" onClick={run} disabled={busy}>{busy?'Compiling schedule…':'Generate coordinated plan'}</button>
      <div className="muted" style={{fontSize:9.5,marginTop:9}}>Runs the live constraint compiler — the same engine the Curriculum Studio uses.</div>
     </div>}
     {plan&&<div>
      <div className="legend">
       <span><span className="phase-badge pb-opening">Opening</span> whole class</span>
       <span><span className="phase-badge pb-turn">Teacher turn</span> one grade at a time</span>
       {buffer>0&&<span><span className="phase-badge pb-transition">Transition</span> material swap</span>}
       <span><span className="phase-badge pb-closing">Closing</span> check for all</span>
      </div>
      <div className="timeline">
       {plan.slots.map((s,i)=>{
        const lanes=s.lanes&&s.lanes.length?s.lanes:(s.kind==='turn'
         ?[{who:'You (teacher)',doing:'Teacher-led focus',is_teacher:'1'},
           ...s.grades.filter(g=>g!==s.focus).map(g=>({who:g,doing:'Independent work',is_teacher:''}))]
         :[])
        return <div className="tl-row" key={i}>
         <div className="tl-time">
          <b>{fmt(s.start)}–{fmt(s.end)}</b>
          <small>{s.end-s.start} min</small>
          <span className={'phase-badge pb-'+s.kind}>{s.kind}</span>
         </div>
         <div className="tl-body">
          <b>{s.focus}</b>
          <div className="role">{s.teacher} · {s.objective}</div>
          <p>{s.activity}</p>
          {lanes.length>0&&<div className="lanes">
           {lanes.map((l,n)=><div className={'lane'+(l.is_teacher?'':' muted-lane')} key={n}>
            <span className="who">{l.who}</span><span className="doing">{l.doing}</span>
           </div>)}
          </div>}
          {s.early_finishers&&<div className="indep-list" style={{marginTop:8}}>
           <div className="indep-item"><IconClock size={14}/><span><b>Early finishers:</b> {s.early_finishers}</span></div>
          </div>}
          <div className="tl-check"><IconCheck size={13}/> Check: {s.check}</div>
         </div>
        </div>})}
      </div>
      <div className="grid" style={{gridTemplateColumns:`repeat(${Math.min(grades.length,3)},1fr)`,marginTop:14}}>
       {plan.assessments.map(a=><div className="notice" key={a.grade}><b>Grade {a.grade} · assessment</b><div style={{marginTop:4}}>{a.prompt}</div><div style={{marginTop:6,color:'#829087'}}>{a.follow_up}</div></div>)}
      </div>
      <div className="step-foot">
       <span className="muted">Engine: {plan.engine} · {plan.slots.length} stages · exact fit to {minutes} min</span>
       <div className="row">
        <button className="btn btn-small" onClick={()=>{setPlan(null);setStage(3)}}>← Adjust goal</button>
        <button className="btn btn-small btn-primary" onClick={save}>Save plan</button>
       </div>
      </div>
     </div>}
    </div>}

    {/* ---------- nav ---------- */}
    <div className="divider" style={{margin:'18px 0 0'}}/>
    <div className="step-foot">
     <span className="muted">{stage<5?`Stage ${stage} of 5 · ${STAGES[stage-1].hint}`:'Review, then save to My resources.'}</span>
     <div className="row">
      {stage>1&&<button className="btn btn-small" onClick={()=>setStage(stage-1)}>← Back</button>}
      {stage<4&&<button className="btn btn-small btn-primary" disabled={!canAdvance[stage-1]} onClick={()=>setStage(stage+1)}>Continue</button>}
      {stage===4&&<button className="btn btn-small btn-primary" disabled={!feasibility.ok} onClick={()=>setStage(5)}>Go to plan</button>}
      {stage===5&&plan&&<Link className="btn btn-small" href="/resources">Open My resources</Link>}
     </div>
    </div>
   </section>
  </div>
  {toast&&<div className="toast">✓ &nbsp;{toast}</div>}
 </Layout>
}
