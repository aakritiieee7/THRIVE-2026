import {useEffect,useState} from 'react'
import Layout from '../components/Layout'
import {trainingCourses,useStoredState} from '../lib/storage'
import {api,getToken} from '../lib/api'
import {IconBookmark,IconBookmarkFill,IconCheck} from '../components/Icons'

type Check={q:string;options:string[];answer:number}
/* Knowledge checks: short practice questions per course — a reflection aid,
   not an exam, and never a certificate. Scores live on this device (and the
   lesson count on the account), so nothing here over-claims. */
const CHECKS:Record<string,Check[]>={
 c1:[
  {q:'What comes first in a coordinated multi-grade period?',
   options:['Independent work for everyone','A shared whole-class opening','A test for every group'],answer:1},
  {q:'While you teach one grade group, the others should be…',
   options:['On a clear independent task you planned','Waiting silently for you','Free to leave their seats'],answer:0},
 ],
 c2:[
  {q:'A quick check for understanding should be…',
   options:['Written in the lesson plan but never used','Short, used often, and acted on','Only given at the end of a term'],answer:1},
  {q:'If a learner misreads a word, the best next move is to…',
   options:['Move on to the next learner','Model it and give one more practice round','Ask them to read it again alone'],answer:1},
 ],
 c3:[
  {q:'Local low-cost materials work best when they…',
   options:['Are new and uniform for everyone','Make the maths idea visible and explainable','Replace the textbook entirely'],answer:1},
  {q:'Letting learners explain their own strategy mainly builds…',
   options:['Repetition speed','Reasoning and language around the concept','Silence during the lesson'],answer:1},
 ],
 c4:[
  {q:'Before a whole-class question, it helps to…',
   options:['Give a little think time','Ask the fastest learner first every time','Read the answer aloud'],answer:0},
  {q:'Offering oral, written and drawn responses is an example of…',
   options:['Assessing less','Multiple ways to participate','Finishing early'],answer:1},
 ],
}

export default function Training(){
 const [progress,setProgress]=useStoredState<Record<string,number>>('training-progress',{})
 const [saved,setSaved]=useStoredState<string[]>('bookmarked-training',[])
 const [course,setCourse]=useState<any>(null),[notice,setNotice]=useState(''),[hydrated,setHydrated]=useState(false)
 const [topic,setTopic]=useState('All')
 const [checkFor,setCheckFor]=useState<any>(null)      // course being quizzed
 const [answers,setAnswers]=useState<Record<number,number>>({})
 const [revealed,setRevealed]=useState(false)
 const topics=['All',...Array.from(new Set(trainingCourses.map((c:any)=>c.topic))) as string[]]

 // Pull server progress for signed-in teachers; local copy is the offline fallback.
 useEffect(()=>{
  if(!getToken()){setHydrated(true);return}
  ;(async()=>{
   try{
    const rows=await api.get<any[]>('/api/training/progress')
    if(Array.isArray(rows)&&rows.length){
     const merged:Record<string,number>={...progress}
     for(const r of rows)merged[r.course_id]=Math.max(merged[r.course_id]||0,r.lessons_done||0)
     setProgress(merged)
    }
   }catch{}finally{setHydrated(true)}
  })()
 },[])

 // Sync saved courses to the account when signed in (local copy always works).
 useEffect(()=>{
  if(!getToken())return
  ;(async()=>{
   try{
    const r=await api.get<{item_ids:string[]}>('/api/training/bookmarks')
    if(r?.item_ids?.length)setSaved(Array.from(new Set([...saved,...r.item_ids])))
   }catch{}
  })()
 },[])

 async function toggleSaved(id:string){
  const on=saved.includes(id)
  setSaved(on?saved.filter(x=>x!==id):[...saved,id])
  if(getToken()){
   try{
    if(on)await api.delete(`/api/training/bookmarks/${id}`)
    else await api.put(`/api/training/bookmarks/${id}`)
   }catch{}
  }
 }

 async function advance(c:any){
  const n=Math.min(c.lesson.length,(progress[c.id]||0)+1)
  const next={...progress,[c.id]:n}
  setProgress(next)
  if(getToken()){try{await api.put('/api/training/progress',{course_id:c.id,lessons_done:n})}catch{}}
  setNotice(n===c.lesson.length?'Course marked complete. This is a THRIVE learning record, not an official certificate.':'Lesson marked complete. Your progress is saved.')
  setTimeout(()=>setNotice(''),2800)
 }

 function startCheck(c:any){
  setCheckFor(c);setAnswers({});setRevealed(false)
 }
 function submitCheck(){
  const checks=CHECKS[checkFor.id]||[]
  const right=checks.reduce((a,q,i)=>a+(answers[i]===q.answer?1:0),0)
  setRevealed(true)
  setNotice(`Practice score: ${right} of ${checks.length} correct. This is a self-check, not a certification.`)
  setTimeout(()=>setNotice(''),4200)
 }

 const done=Object.values(progress).reduce((a,b)=>a+b,0)
 const total=trainingCourses.reduce((a,c)=>a+c.lesson.length,0)
 const savedCourses=trainingCourses.filter((c:any)=>saved.includes(c.id))

 return <Layout title="Training centre">
  <div className="page-heading"><div><div className="eyebrow">Training centre</div><h1>Professional learning that fits your day.</h1><p>Short practice modules for classroom teaching, with progress that persists to your account.</p></div><span className="tag">Self-paced learning</span></div>
  <div className="notice" style={{marginBottom:15}}>THRIVE micro-lessons are practice resources, not accredited training or official certification. NEP 2020 encourages at least 50 hours of teacher professional development a year — for government programmes visit DIKSHA/NISHTHA directly.</div>
  <div className="panel" style={{marginBottom:15}}>
   <div className="panel-title"><div><h2>Your learning progress</h2><p>{getToken()?'Synced to your account when online':'Saved on this device (sign in to sync)'}</p></div><b style={{fontSize:10,color:'#598165'}}>{done} of {total} lessons completed</b></div>
   {/* Honest progress: no bar at 0 — a claim of progress needs progress. */}
   {done>0
    ?<div className="progress-line"><i style={{width:`${Math.min(100,Math.round(done/total*100))}%`}}/></div>
    :<div className="muted" style={{fontSize:10.5,marginTop:8,lineHeight:1.6}}>No lessons completed yet — progress appears here once you begin a course.</div>}
  </div>
  <div className="chip-filters" style={{marginBottom:13}} aria-label="Filter courses by category">
   {topics.map(t=><button key={t} className={topic===t?'selected':''} onClick={()=>setTopic(t)}>{t}</button>)}
  </div>
  <div className="grid course-grid">
   {trainingCourses.filter((c:any)=>topic==='All'||c.topic===topic).map((c:any)=>{
    const n=progress[c.id]||0
    const started=n>0
    const complete=n>=c.lesson.length
    return (
     <article className="panel course-card" key={c.id}>
    <div className={'course-band '+c.color}><span className="tag">{c.topic}</span><span style={{fontSize:19}}>✳</span></div>
    <div className="course-body"><h3>{c.title}</h3><p>{c.desc}</p>
     <div className="course-meta"><span>{c.length} · {c.level}</span><span>{n}/{c.lesson.length} lessons</span></div>
     {/* No bar at 0%: an empty progress bar implies progress that isn't there. */}
     {started
      ?<div className="progress-line" style={{marginTop:9}}><i style={{width:`${(n/c.lesson.length)*100}%`}}/></div>
      :<div className="muted" style={{fontSize:9.5,marginTop:9}}>Not started yet.</div>}
     <div style={{display:'flex',gap:7,marginTop:12,flexWrap:'wrap'}}>
      <button className="btn btn-small" onClick={()=>setCourse(c)}>{complete?'Review course':started?'Continue course':'Start course'}</button>
      <button className="btn btn-small" onClick={()=>startCheck(c)} title="Knowledge check — a short self-quiz, not a certification">Knowledge check</button>
      <button className="btn btn-small" onClick={()=>toggleSaved(c.id)} aria-label={saved.includes(c.id)?'Remove bookmark':'Bookmark course'}>
       {saved.includes(c.id)?<IconBookmarkFill size={13}/>:<IconBookmark size={13}/>}{saved.includes(c.id)?' Saved':''}</button>
     </div>
     </div>
     </article>
    )
   })}
   {trainingCourses.filter((c:any)=>topic==='All'||c.topic===topic).length===0&&<div className="empty">No courses in this category yet.</div>}
  </div>
  {savedCourses.length>0&&<section className="panel" style={{marginTop:15}}>
   <div className="panel-title"><div><h2>Saved for later</h2><p>{getToken()?'Bookmarks sync to your account':'Bookmarks stay on this device — sign in to sync'}</p></div></div>
   <div className="plan-list">
    {savedCourses.map((c:any)=><div className="plan-item" key={c.id}>
     <span className="plan-icon">★</span>
     <span><b>{c.title}</b><small>{c.topic} · {c.length} · {progress[c.id]||0}/{c.lesson.length} lessons</small></span>
     <span className="right"><button className="btn btn-small" onClick={()=>setCourse(c)}>Open</button></span>
    </div>)}
   </div>
  </section>}
  <section className="panel" style={{marginTop:15}}>
   <div className="panel-title"><div><h2>Continue with official learning</h2><p>External resources open on the provider's site.</p></div></div>
   <div className="plan-list">
    <div className="plan-item"><span className="plan-icon">↗</span><span><b>DIKSHA</b><small>Teacher courses and resources. Availability varies by state.</small></span><a className="text-link" href="https://diksha.gov.in/" target="_blank" rel="noreferrer">Open DIKSHA ↗</a></div>
    <div className="plan-item"><span className="plan-icon">↗</span><span><b>NISHTHA</b><small>Ask your education department or DIKSHA for current programme details.</small></span><a className="text-link" href="https://diksha.gov.in/" target="_blank" rel="noreferrer">Find courses ↗</a></div>
    <div className="plan-item"><span className="plan-icon">↗</span><span><b>NEP 2020</b><small>Read the policy from the Ministry of Education.</small></span><a className="text-link" href="https://www.education.gov.in/nep/about-nep" target="_blank" rel="noreferrer">View policy ↗</a></div>
   </div>
  </section>
  {course&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>e.target===e.currentTarget&&setCourse(null)}>
   <div className="modal panel">
    <div className="spread"><div><span className="tag">{course.topic} · {course.length}</span><h2 style={{marginTop:10}}>{course.title}</h2></div><button className="btn btn-small" onClick={()=>setCourse(null)}>Close ×</button></div>
    <p className="muted" style={{lineHeight:1.7,fontSize:11}}>{course.desc}</p>
    <div className="divider"/>
    <div><b style={{fontSize:10}}>Lesson {Math.min((progress[course.id]||0)+1,course.lesson.length)} of {course.lesson.length}</b>
     <p style={{fontSize:13,lineHeight:1.8,marginTop:8}}>{course.lesson[Math.min(progress[course.id]||0,course.lesson.length-1)]}</p></div>
    <div className="notice">Reflection: What is one change you could try in your next class?</div>
    <button className="btn btn-primary" style={{marginTop:14}} onClick={()=>advance(course)}>{(progress[course.id]||0)>=course.lesson.length?'Mark reviewed':'Mark lesson complete'}</button>
   </div>
  </div>}
  {checkFor&&(()=>{
   const checks=CHECKS[checkFor.id]||[]
   const right=checks.reduce((a,q,i)=>a+(answers[i]===q.answer?1:0),0)
   return <div className="modal-backdrop" role="presentation" onMouseDown={e=>e.target===e.currentTarget&&setCheckFor(null)}>
    <div className="modal panel">
     <div className="spread"><div><span className="tag">Knowledge check · practice</span><h2 style={{marginTop:10}}>{checkFor.title}</h2></div>
      <button className="btn btn-small" onClick={()=>setCheckFor(null)}>Close ×</button></div>
     <div className="notice">A short self-check to revisit key ideas. Scores stay on this device and are not a certificate or accreditation.</div>
     {checks.map((q,i)=><div key={i} style={{marginTop:14}}>
      <b style={{fontSize:12.5}}>{i+1}. {q.q}</b>
      <div style={{display:'grid',gap:6,marginTop:7}}>
       {q.options.map((o,j)=>{const picked=answers[i]===j;const isRight=revealed&&j===q.answer
        return <button key={j} className="btn" disabled={revealed}
          style={{textAlign:'left',justifyContent:'flex-start',lineHeight:1.5,
           borderColor:isRight?'var(--forest)':picked?'var(--honey-deep)':'var(--line)',
           background:isRight?'rgba(64,102,74,.08)':picked?'rgba(213,165,64,.1)':'transparent'}}
          onClick={()=>setAnswers({...answers,[i]:j})}>
          {isRight&&<IconCheck size={12} style={{display:'inline',marginRight:5,verticalAlign:'-2px'}}/>}
          {o}</button>})}
      </div>
     </div>)}
     {!revealed
      ?<button className="btn btn-primary" style={{marginTop:16}} disabled={Object.keys(answers).length<checks.length}
        onClick={submitCheck}>Check my answers</button>
      :<div className="notice" style={{marginTop:16}}>
        <b>{right} of {checks.length} correct.</b> {right===checks.length?'Nice work — revisit the lessons any time to keep it fresh.':'Review the highlighted answers, then open the lesson again — a THRIVE practice record, not a certification.'}
        <div style={{marginTop:9,display:'flex',gap:7}}>
         <button className="btn btn-small" onClick={()=>{setAnswers({});setRevealed(false)}}>Retake</button>
         <button className="btn btn-small" onClick={()=>setCheckFor(null)}>Done</button>
        </div>
       </div>}
    </div>
   </div>
  })()}
  {notice&&<div className="toast" aria-live="polite">✓ &nbsp;{notice}</div>}
 </Layout>
}
