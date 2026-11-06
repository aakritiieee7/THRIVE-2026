import {useEffect,useMemo,useState} from 'react'
import Layout from '../components/Layout'
import {useStoredState} from '../lib/storage'
import {api} from '../lib/api'
import {fetchChapters,matchChapter,SHARED_TOPICS,SubjectChapters} from '../lib/curriculum'

type GradePlan={grade:string;topic:string;objective:string;shared:string}
type Slot={start:number;end:number;focus:string;grades:string;objective:string;teacher:string;activity:string;materials:string;check:string;kind:string}
type PlanResult={slots:Slot[];assessments:{grade:string;prompt:string;follow_up:string}[];engine:string;sources:{kind:string;note:string}[]}

const defaults:GradePlan[]=[
 {grade:'3',topic:'Shapes and Patterns',objective:'Recognize common 2D shapes and create a repeating pattern',shared:''},
 {grade:'5',topic:'Fractions',objective:'Represent and compare simple fractions using paper folding',shared:''}
]
const fmt=(n:number)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`

export default function Compiler(){
 const [grades,setGrades]=useState<GradePlan[]>(defaults),[minutes,setMinutes]=useState(45),[subject,setSubject]=useState('Mathematics'),[medium,setMedium]=useState('Hindi'),[board,setBoard]=useState('Bihar SCERT'),[materials,setMaterials]=useState('paper, chalk, classroom objects'),[buffer,setBuffer]=useState(0)
 const [plan,setPlan]=useState<PlanResult|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const [savedPlans,setSavedPlans]=useStoredState<any[]>('plans',[]),[toast,setToast]=useState('')
 const [catalogs,setCatalogs]=useState<Record<string,SubjectChapters[]|null>>({})
 const online=useMemo(()=>typeof window!=='undefined',[])

 function setGrade(i:number,key:keyof GradePlan,value:string){setGrades(old=>old.map((g,n)=>n===i?{...g,[key]:value}:g))}

 // Load curriculum chapters per grade (contextual topic suggestions).
 useEffect(()=>{
  let live=true
  ;(async()=>{
   for(const g of grades){
    const key=g.grade
    if(catalogs[key]!==undefined)continue
    const data=await fetchChapters(key,subject)
    if(live)setCatalogs(c=>({...c,[key]:data}))
   }
  })()
  return ()=>{live=false}
 },[grades.map(g=>g.grade).join(','),subject])

 // Auto-fill curriculum-grounded objective when the topic matches a chapter.
 function pickTopic(i:number,value:string){
  setGrade(i,'topic',value)
  const g=grades[i]
  const subjects=catalogs[g.grade]
  const {chapter}=matchChapter(value,subjects)
  if(chapter&&value.trim().length>3){
   const first=chapter.learning_outcomes[0]?.text
   if(first)setGrade(i,'objective',first)
  }
 }

 async function generate(){
  setError('');setPlan(null)
  if(!Number.isInteger(minutes)||minutes<20||minutes>180){setError('Choose a teaching period between 20 and 180 minutes.');return}
  if(grades.length<1||grades.length>5||grades.some(g=>!g.grade.trim()||!g.topic.trim()||!g.objective.trim())){setError('Add a grade, topic and learning goal for every group.');return}
  if(new Set(grades.map(g=>g.grade.trim())).size!==grades.length){setError('Each grade can appear only once.');return}
  setBusy(true)
  try{
   const body={subject,medium,board,minutes,materials,transition_buffer:buffer,
    grades:grades.map(g=>({grade:g.grade,topic:g.topic,objective:g.objective,shared_group:g.shared||null}))}
   const r=await api.post('/api/compiler/run',body)
   setPlan(r as PlanResult)
  }catch(err:any){
   if(err?.status===422){
    setError(err.message||'The schedule does not fit these constraints. Adjust duration or grade count.')
   }else{
    setError(err?.message||'Could not reach the compiler service. Please check that the backend is running and retry.')
   }
  }finally{setBusy(false)}
 }

 async function save(){
  if(!plan)return
  const item={title:`${subject}: ${grades.map(g=>`Grade ${g.grade}`).join(' & ')}`,grades,minutes,subject,medium,board,materials,schedule:plan.slots,assessments:plan.assessments,savedAt:new Date().toISOString()}
  try{
   const r=await api.post('/api/plans',{title:item.title,subject,medium,board,minutes,payload:item})
   setSavedPlans([{...item,id:r.id,server:true},...savedPlans])
  }catch{
   setSavedPlans([{...item,id:Date.now()},...savedPlans])
  }
  setToast('Lesson plan saved to My resources');setTimeout(()=>setToast(''),2400)
 }

 function exportCsv(){
  if(!plan)return
  const rows=[['Start','End','Group','Learning objective','Teacher role','Activity','Materials','Check'],
   ...plan.slots.map(s=>[fmt(s.start),fmt(s.end),s.focus,s.objective,s.teacher,s.activity,s.materials,s.check])]
  const csv=rows.map(r=>r.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\n')
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='thrive-multigrade-plan.csv';a.click();URL.revokeObjectURL(a.href)
 }

 const topicsShared=grades.length>1&&grades.every(g=>g.topic.trim().toLowerCase()===grades[0].topic.trim().toLowerCase())

 return <Layout title="Curriculum Studio">
  <div className="page-heading"><div><div className="eyebrow">CURRICULUM STUDIO · MULTI-GRADE COMPILER</div><h1>One classroom. One coordinated plan.</h1><p>Constraint-checked schedules across your grade groups, grounded in curriculum structure.</p></div></div>
  <div className="notice" style={{marginBottom:15}}><b>Curriculum coverage is partial.</b> Seeded NCERT-aligned chapters for Grades 1–5 (Mathematics, EVS). Bihar SCERT content is not yet ingested — treat teacher-entered goals as context and review every suggestion against your official syllabus.</div>
  <div className="grid" style={{gridTemplateColumns:'minmax(0,1fr) 290px',alignItems:'start'}}>
   <section className="panel">
    <div className="panel-title"><div><h2>Set up your classroom</h2><p>Plan around the whole room, not a separate lesson per grade.</p></div><span className="tag">STEP 1 OF 1</span></div>
    <div className="form-grid">
     <div className="field"><label>Curriculum / board</label><select value={board} onChange={e=>setBoard(e.target.value)}><option>Bihar SCERT</option><option>NCERT</option><option>Other — teacher-provided goals</option></select></div>
     <div className="field"><label>Medium of instruction</label><select value={medium} onChange={e=>setMedium(e.target.value)}><option>Hindi</option><option>English</option><option>Hindi + English</option></select></div>
     <div className="field"><label>Subject</label><select value={subject} onChange={e=>setSubject(e.target.value)}>{['Mathematics','Environmental Studies','Language','Science','Social Science'].map(s=><option key={s}>{s}</option>)}</select></div>
     <div className="field"><label>Available class time (minutes)</label><input type="number" min="20" max="180" value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></div>
    </div>
    <div className="spread" style={{margin:'12px 0 9px'}}><div><b style={{fontSize:11}}>Grade groups &amp; learning goals</b><div className="muted" style={{fontSize:9,marginTop:3}}>Pick a seeded chapter or enter your own goal; objectives auto-fill from curriculum outcomes when matched.</div></div><button className="btn btn-small" onClick={()=>grades.length<5&&setGrades([...grades,{grade:String(grades.length+1),topic:'',objective:'',shared:''}])} disabled={grades.length>=5}>＋ Add grade</button></div>
    <div className="grade-inputs">
     {grades.map((g,i)=>{
      const subjects=catalogs[g.grade]
      const {chapter}=matchChapter(g.topic,subjects)
      return <div className="grade-row" key={i} style={{gridTemplateColumns:'70px 1fr 1.2fr 90px 30px'}}>
       <div className="field"><label>Grade</label><select value={g.grade} onChange={e=>setGrade(i,'grade',e.target.value)}>{Array.from({length:12},(_,n)=><option key={n+1}>{n+1}</option>)}</select></div>
       <div className="field"><label>Topic or chapter</label><input list={`topics-${i}`} value={g.topic} onChange={e=>pickTopic(i,e.target.value)} placeholder="e.g. Shapes and Patterns"/><datalist id={`topics-${i}`}>{(subjects??[]).flatMap(s=>s.chapters.map(c=><option key={c.id} value={c.title}/>))}</datalist></div>
       <div className="field"><label>Learning goal</label><input value={g.objective} onChange={e=>setGrade(i,'objective',e.target.value)} placeholder="What will learners do?"/>{chapter&&<small style={{fontSize:8,color:'#6b8f77'}}>From curriculum: {chapter.id} · {chapter.learning_outcomes.length} outcomes</small>}</div>
       <div className="field"><label>Shared group</label><select value={g.shared} onChange={e=>setGrade(i,'shared',e.target.value)}><option value="">— separate</option>{SHARED_TOPICS.filter(s=>s.grades.includes(g.grade)).map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
       <button className="remove" aria-label="Remove grade" onClick={()=>grades.length>1&&setGrades(grades.filter((_,n)=>n!==i))}>×</button>
      </div>})}
    </div>
    <div className="form-grid" style={{marginTop:12}}>
     <div className="field"><label>Materials available in your classroom</label><input value={materials} onChange={e=>setMaterials(e.target.value)} placeholder="e.g. seeds, paper, chalk, number cards"/><small className="muted" style={{fontSize:9}}>Suggestions use only these materials.</small></div>
     <div className="field"><label>Transition time between groups (minutes)</label><input type="number" min="0" max="10" value={buffer} onChange={e=>setBuffer(Number(e.target.value))}/><small className="muted" style={{fontSize:9}}>Extra minutes for material swaps with 3+ grades.</small></div>
    </div>
    {error&&<div className="notice" style={{background:'#fbefec',borderColor:'#f2d8d0',color:'#925e4d',marginBottom:12}}>{error}</div>}
    <button className="btn btn-primary" onClick={generate} disabled={busy}>{busy?'Compiling schedule…':'Generate coordinated plan →'}</button>
   </section>
   <aside className="panel">
    <div className="panel-title"><div><h2>Planning guardrails</h2><p>Enforced by the constraint engine</p></div></div>
    <div style={{display:'grid',gap:13}}>
     <div className="row" style={{alignItems:'flex-start'}}><span className="tag">01</span><div><b style={{fontSize:10}}>Exact fit</b><div className="muted" style={{fontSize:9,lineHeight:1.6,marginTop:4}}>The plan must fill exactly {minutes} minutes — impossible inputs are rejected, not faked.</div></div></div>
     <div className="row" style={{alignItems:'flex-start'}}><span className="tag">02</span><div><b style={{fontSize:10}}>One teacher, one turn</b><div className="muted" style={{fontSize:9,lineHeight:1.6,marginTop:4}}>Teacher attention is never double-booked; waiting groups get independent tasks.</div></div></div>
     <div className="row" style={{alignItems:'flex-start'}}><span className="tag">03</span><div><b style={{fontSize:10}}>No forced merging</b><div className="muted" style={{fontSize:9,lineHeight:1.6,marginTop:4}}>Grades are taught together only when you mark a genuine shared group.</div></div></div>
    </div>
    <div className="divider"/>
    <div className="notice">{online?'Compiler runs on the backend and rejects infeasible schedules with explicit reasons.':'Compiler service status unknown.'}</div>
   </aside>
  </div>
  {plan&&<section className="panel" style={{marginTop:16}}>
   <div className="module-head"><div><h2>Your coordinated classroom schedule</h2><p>{subject} · {medium} · {minutes} minutes · {grades.length} grade groups · engine: {plan.engine}</p></div><div className="row"><button className="btn btn-small" onClick={()=>window.print()}>⎙ Print</button><button className="btn btn-small" onClick={exportCsv}>↓ CSV</button><button className="btn btn-small btn-primary" onClick={save}>Save plan</button></div></div>
   {topicsShared&&<div className="notice" style={{marginBottom:12}}>All grades share the same topic. Goals stay separate; each grade still gets a distinct teacher-led turn.</div>}
   <div style={{overflowX:'auto'}}><table className="schedule"><thead><tr><th>TIME</th><th>GROUP</th><th>LEARNING GOAL</th><th>TEACHER &amp; STUDENT ACTIVITY</th><th>MATERIALS / CHECK</th></tr></thead><tbody>{plan.slots.map((s,i)=><tr key={i}><td className="time">{fmt(s.start)}–{fmt(s.end)}<div className="subtask">{s.end-s.start} min</div></td><td className="grade-cell">{s.focus}</td><td>{s.objective}</td><td><div className="task">{s.teacher}</div><div className="subtask">{s.activity}</div></td><td><div>{s.materials}</div><div className="subtask">Check: {s.check}</div></td></tr>)}</tbody></table></div>
   <div className="grid" style={{gridTemplateColumns:`repeat(${Math.min(grades.length,3)},1fr)`,marginTop:15}}>{plan.assessments.map(a=><div className="notice" key={a.grade}><b>Grade {a.grade} · assessment</b><div style={{marginTop:4}}>{a.prompt}</div><div style={{marginTop:6,color:'#829087'}}>{a.follow_up}</div></div>)}</div>
   <div className="source-line" style={{marginTop:12}}>{plan.sources.map((s,i)=><span key={i}>{s.note}</span>)}</div>
  </section>}
  {toast&&<div className="toast">✓ &nbsp;{toast}</div>}
 </Layout>
}
