import {useEffect,useState} from 'react'
import {useRouter} from 'next/router'
import Layout from '../components/Layout'
import {useStoredState,EMPTY_PROFILE} from '../lib/storage'
import {api,getToken,setToken} from '../lib/api'
import {getGuest,clearGuest} from '../lib/guest'

export default function Profile(){
 const router=useRouter()
 const [profile,setProfile]=useStoredState<any>('profile',EMPTY_PROFILE)
 const [saved,setSaved]=useState(false)
 const [session,setSession]=useState<{name:string;email:string}|null>(null)
 const [isGuest,setIsGuest]=useState(false)
 const [deleting,setDeleting]=useState(false)
 const [confirmDelete,setConfirmDelete]=useState(false)
 const [authMsg,setAuthMsg]=useState('')
 const [waStatus,setWaStatus]=useState<any>(null)
 const [waLink,setWaLink]=useState<any>(null)
 const [waCode,setWaCode]=useState('')
 const [waBusy,setWaBusy]=useState(false)
 const [waMsg,setWaMsg]=useState('')

 useEffect(()=>{
  setIsGuest(!!getGuest())
  // Integration status is public (shows live vs simulation) — fetch always.
  api.get<any>('/api/assistant/whatsapp/status').then(setWaStatus).catch(()=>setWaStatus(null))
  if(!getToken())return
  ;(async()=>{
   try{const me=await api.get<any>('/api/auth/me');setSession({name:me.name,email:me.email});setProfile((p:any)=>({...p,name:me.name,email:me.email,...(me.profile||{})}))}catch{setToken(null);return}
   // Signed in — load this account's WhatsApp link state.
   try{setWaLink(await api.get<any>('/api/assistant/whatsapp/link'))}catch{}
  })()
 },[])

 async function getLinkCode(){
  if(waBusy)return
  setWaBusy(true);setWaMsg('');setWaCode('')
  try{
   const r=await api.post<any>('/api/assistant/whatsapp/link-code')
   setWaCode(r.code);setWaLink(await api.get<any>('/api/assistant/whatsapp/link').catch(()=>waLink))
  }catch(e:any){setWaMsg(e.message||'Could not generate a link code right now.')}
  finally{setWaBusy(false)}
 }

 async function doUnlink(){
  if(waBusy)return
  if(!confirm('Unlink this number from your account? You will stop being able to save from WhatsApp until you link again.'))return
  setWaBusy(true);setWaMsg('');setWaCode('')
  try{await api.delete('/api/assistant/whatsapp/link');setWaLink({linked:false})}
  catch(e:any){setWaMsg(e.message||'Could not unlink right now.')}
  finally{setWaBusy(false)}
 }

 async function copyCode(){
  try{await navigator.clipboard.writeText(`link ${waCode}`);setWaMsg('Copied — paste it into the bot chat.')
  }catch{setWaMsg('Copy the code below and send it to the bot.')}
 }

 function update(key:string,value:string){setProfile({...profile,[key]:value})}

 async function savePreferences(){
  if(getToken()){
   try{
    await api.put('/api/auth/me',{name:profile.name,profile:{state:profile.state,board:profile.board,medium:profile.medium,grades:profile.grades,subjects:profile.subjects,language:profile.language,school:profile.school}})
   }catch{}
  }
  setSaved(true);setTimeout(()=>setSaved(false),2500)
 }

 // Signing out ends the account session only — the teaching context saved on
 // this device stays, so the next sign-in (or guest visit) picks it up.
 async function signout(){setToken(null);setSession(null);setIsGuest(false)}

 async function deleteAccount(){
  if(deleting)return
  setDeleting(true);setAuthMsg('')
  try{
   await api.delete('/api/auth/me')
   setToken(null);setSession(null);clearGuest()
   setProfile({...EMPTY_PROFILE})
   router.push('/landing')
  }catch(err:any){setAuthMsg(err.message||'Could not delete the account right now — check your connection and try again.')}
  finally{setDeleting(false);setConfirmDelete(false)}
 }

 return <Layout title="My profile">
  <div className="page-heading"><div><div className="eyebrow">Your teaching context</div><h1>Make THRIVE fit your classroom.</h1><p>This context tailors the assistant, compiler and training suggestions.</p></div></div>
  <div className="profile-layout">
   <aside className="panel profile-hero">
    <div className="profile-photo">{(profile.name||'T').trim()[0]?.toUpperCase()}</div>
    <h2>{profile.name||'Teacher'}</h2>
    <p>{[profile.state,profile.board].filter(Boolean).join(' · ')||'Set your teaching context'}</p>
    <div className="divider"/>
    {session?<div>
     <div className="tag" style={{marginBottom:8}}>Signed in</div>
     <div className="muted" style={{fontSize:9,marginBottom:8,wordBreak:'break-all'}}>{session.email}</div>
     <div className="row" style={{gap:6,flexWrap:'wrap'}}>
      <button className="btn btn-small" onClick={signout}>Sign out</button>
      <a className="btn btn-small" href="/login">Switch account</a>
     </div>
     <div className="divider"/>
     <div style={{fontSize:9.5,fontWeight:700,marginBottom:6}}>Account settings</div>
     <div className="muted" style={{fontSize:9,lineHeight:1.7,marginBottom:8}}>
      Your name, context and saved plans live in this account. Deleting the account removes them permanently.
     </div>
     {!confirmDelete
      ? <button className="btn btn-danger btn-small" style={{width:'100%',justifyContent:'center'}} onClick={()=>setConfirmDelete(true)}>Delete account</button>
      : <div className="notice" style={{background:'#fbefec',borderColor:'#f2d8d0',color:'#925e4d',textAlign:'left'}}>
         <b>Delete your account?</b> This removes your profile, saved plans, training progress and community posts. It cannot be undone.
         <div className="row" style={{gap:6,marginTop:8}}>
          <button className="btn btn-danger btn-small" disabled={deleting} onClick={deleteAccount}>{deleting?'Deleting…':'Yes, delete'}</button>
          <button className="btn btn-small" disabled={deleting} onClick={()=>setConfirmDelete(false)}>Cancel</button>
         </div>
        </div>}
     {authMsg&&<div className="notice" role="alert" style={{background:'#fbefec',borderColor:'#f2d8d0',color:'#925e4d',marginTop:8,textAlign:'left'}}>{authMsg}</div>}
    </div>:<div>
     <div className="tag" style={{marginBottom:8}}>{isGuest?'Exploring as guest':'Not signed in'}</div>
     <div className="muted" style={{fontSize:9,lineHeight:1.7,marginBottom:10}}>
      {isGuest
       ?'Your drafts are saved on this device. Sign in to keep them in your account.'
       :'Sign in to sync your teaching context, saved plans and progress across devices.'}
     </div>
     <div className="row" style={{gap:6,flexWrap:'wrap'}}>
      <a className="btn btn-primary btn-small" href="/login">Sign in</a>
      <a className="btn btn-small" href="/signup">Create account</a>
     </div>
     {!isGuest&&<div style={{marginTop:8,fontSize:9}}><a className="text-link" href="/try">Try THRIVE as a guest</a></div>}
    </div>}
    <div className="divider"/>
    <div className="notice" style={{textAlign:'left'}}>No student information is needed. Avoid entering identifiable student data anywhere in THRIVE.</div>
   </aside>
   <section className="panel">
    <div className="panel-title"><div><h2>Teacher profile</h2><p>Used by your teaching assistant and planner</p></div></div>
    <div className="form-grid">
     <div className="field"><label>Your name</label><input value={profile.name} onChange={e=>update('name',e.target.value)} placeholder="How should THRIVE address you?"/></div>
     <div className="field"><label>Email</label><input type="email" value={session?.email||profile.email||''} onChange={e=>update('email',e.target.value)} placeholder={session?'':'optional'} disabled={!!session} title={session?'Managed by your account':'Optional'}/></div>
     <div className="field"><label>State</label><select value={profile.state} onChange={e=>update('state',e.target.value)}><option value="">Select a state…</option>{['Bihar','Delhi','Uttar Pradesh','Madhya Pradesh','Rajasthan','Other'].map(x=><option key={x}>{x}</option>)}</select></div>
     <div className="field"><label>Board / curriculum</label><select value={profile.board} onChange={e=>update('board',e.target.value)}><option value="">Select a board…</option>{['Bihar SCERT','NCERT','State curriculum — other','Other'].map(x=><option key={x}>{x}</option>)}</select></div>
     <div className="field"><label>Medium(s) of instruction</label><select value={profile.medium} onChange={e=>update('medium',e.target.value)}><option value="">Select a medium…</option>{['Hindi + English','Hindi','English','Other'].map(x=><option key={x}>{x}</option>)}</select></div>
     <div className="field"><label>Grades you teach (comma separated)</label><input value={profile.grades} onChange={e=>update('grades',e.target.value)} placeholder="e.g. 3, 5"/></div>
     <div className="field"><label>Subjects (comma separated)</label><input value={profile.subjects} onChange={e=>update('subjects',e.target.value)} placeholder="e.g. Mathematics, EVS"/></div>
     <div className="field"><label>School (optional)</label><input value={profile.school||''} onChange={e=>update('school',e.target.value)} placeholder="School name"/></div>
     <div className="field"><label>Preferred assistant response</label><select value={profile.language} onChange={e=>update('language',e.target.value)}><option>English</option><option>Hindi</option></select></div>
    </div>
    <div className="divider"/>
    <div className="spread"><div className="muted" style={{fontSize:9}}>{session?'Saved to your account and this device.':'Saved on this device — sign in to sync across devices.'}</div>
     <button className="btn btn-primary" onClick={savePreferences}>Save preferences</button></div>
    {saved&&<div className="notice" style={{marginTop:10}}>✓ Preferences saved.</div>}
   </section>
   {session&&<section className="panel">
    <div className="panel-title"><div><h2>WhatsApp</h2><p>Turn this phone number into a THRIVE contact</p></div>
     <span className="tag" style={{background:waStatus?.live?'#e7f5ec':'#f3f1ec',color:waStatus?.live?'var(--forest)':'var(--muted)'}}>{waStatus?.live?'Live':'Connecting…'}</span></div>
    <div style={{fontSize:10,lineHeight:1.7,color:'var(--muted)',marginBottom:12}}>
     Link your number once, then message THRIVE from WhatsApp like any contact —
     <b> "plan: Grade 2 and 3, 40 min, maths"</b> builds and saves a schedule,
     <b> "post:"</b> publishes to the community, <b> "progress c1 2"</b> updates training,
     <b> "remind:"</b> sets reminders, and anything else gets an assistant answer.
    </div>
    {waLink?.linked
     ? <div className="notice" style={{background:'#e7f5ec',borderColor:'#cfe8d9',color:'var(--forest)',textAlign:'left'}}>
        ✓ Linked to <b>{waLink.phone_masked}</b>
        {waLink.linked_at?` on ${waLink.linked_at.slice(0,10)}`:''}. Message THRIVE from this number to manage your account.
        <div className="row" style={{gap:6,marginTop:8}}>
         <button className="btn btn-small" disabled={waBusy} onClick={doUnlink}>{waBusy?'Unlinking…':'Unlink this number'}</button>
        </div>
       </div>
     : <div>
        <div className="row" style={{gap:6,flexWrap:'wrap'}}>
         <button className="btn btn-primary btn-small" disabled={waBusy} onClick={getLinkCode}>{waBusy?'Generating…':'Get link code'}</button>
        </div>
        {waCode&&<div style={{marginTop:12,textAlign:'left'}}>
         <div style={{fontSize:9.5,fontWeight:700,marginBottom:6}}>1 · Send this to the THRIVE bot from your number (expires in 10 min):</div>
         <div className="row" style={{gap:6,alignItems:'center',flexWrap:'wrap'}}>
          <code style={{fontSize:13,fontWeight:700,letterSpacing:1.5,background:'var(--paper,#faf8f4)',border:'1px solid var(--line,#e4ded2)',padding:'6px 12px',borderRadius:8}}>link {waCode}</code>
          <button className="btn btn-small" onClick={copyCode}>Copy</button>
         </div>
         <div style={{fontSize:9,marginTop:8,color:'var(--muted)'}}>
          {waStatus?.live&&waCode
           ?waStatus?.note
           :'The bot is not connected to a real number yet — once your administrator adds the WhatsApp Business credentials, sending this code from your phone completes the link.'}
         </div>
        </div>}
        {waMsg&&<div className="notice" style={{marginTop:10,background:'#fbefec',borderColor:'#f2d8d0',color:'#925e4d',textAlign:'left'}} role="alert">{waMsg}</div>}
       </div>}
   </section>}
  </div>
 </Layout>
}
