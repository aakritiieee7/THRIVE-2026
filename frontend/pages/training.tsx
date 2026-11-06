import {useEffect,useState} from 'react'
import Layout from '../components/Layout'
import {seedCourses,useStoredState} from '../lib/storage'
import {api,getToken} from '../lib/api'

export default function Training(){
 const [progress,setProgress]=useStoredState<Record<string,number>>('training-progress',{})
 const [course,setCourse]=useState<any>(null),[notice,setNotice]=useState(''),[hydrated,setHydrated]=useState(false)

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

 async function advance(c:any){
  const n=Math.min(c.lesson.length,(progress[c.id]||0)+1)
  const next={...progress,[c.id]:n}
  setProgress(next)
  if(getToken()){try{await api.put('/api/training/progress',{course_id:c.id,lessons_done:n})}catch{}}
  setNotice(n===c.lesson.length?'Course marked complete. This is a THRIVE learning record, not an official certificate.':'Lesson marked complete. Your progress is saved.')
  setTimeout(()=>setNotice(''),2800)
 }

 const done=Object.values(progress).reduce((a,b)=>a+b,0)
 const total=seedCourses.reduce((a,c)=>a+c.lesson.length,0)

 return <Layout title="Training centre">
  <div className="page-heading"><div><div className="eyebrow">TRAINING CENTRE</div><h1>Professional learning that fits your day.</h1><p>Short practice modules for classroom teaching, with progress that persists to your account.</p></div><span className="tag">SELF-PACED LEARNING</span></div>
  <div className="notice" style={{marginBottom:15}}>THRIVE micro-lessons are practice resources, not accredited training or official certification. NEP 2020 encourages at least 50 hours of teacher professional development a year — for government programmes visit DIKSHA/NISHTHA directly.</div>
  <div className="panel" style={{marginBottom:15}}>
   <div className="panel-title"><div><h2>Your learning progress</h2><p>{getToken()?'Synced to your account when online':'Saved on this device (sign in to sync)'}</p></div><b style={{fontSize:10,color:'#598165'}}>{done} of {total} lessons completed</b></div>
   <div className="progress-line"><i style={{width:`${Math.min(100,Math.round(done/total*100))}%`}}/></div>
  </div>
  <div className="grid course-grid">
   {seedCourses.map((c:any)=>{const n=progress[c.id]||0;return <article className="panel course-card" key={c.id}>
    <div className={'course-band '+c.color}><span className="tag">{c.topic}</span><span style={{fontSize:19}}>✳</span></div>
    <div className="course-body"><h3>{c.title}</h3><p>{c.desc}</p>
     <div className="course-meta"><span>{c.length} · {c.level}</span><span>{n}/{c.lesson.length} lessons</span></div>
     <div className="progress-line" style={{marginTop:9}}><i style={{width:`${(n/c.lesson.length)*100}%`}}/></div>
     <button className="btn btn-small" style={{marginTop:12}} onClick={()=>setCourse(c)}>{n>=c.lesson.length?'Review course':'Continue course'} →</button>
    </div></article>})}
  </div>
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
    <button className="btn btn-primary" style={{marginTop:14}} onClick={()=>advance(course)}>{(progress[course.id]||0)>=course.lesson.length?'Mark reviewed':'Mark lesson complete'} →</button>
   </div>
  </div>}
  {notice&&<div className="toast">✓ &nbsp;{notice}</div>}
 </Layout>
}
