import {useEffect,useState} from 'react'
import Layout from '../components/Layout'
import {useStoredState} from '../lib/storage'
import {api,getToken,setToken} from '../lib/api'

const defaults={name:'',email:'',state:'Bihar',board:'Bihar SCERT',medium:'Hindi + English',grades:'3, 5',subjects:'Mathematics',school:'',language:'English'}

export default function Profile(){
 const [profile,setProfile]=useStoredState<any>('profile',defaults)
 const [saved,setSaved]=useState(false)
 const [session,setSession]=useState<{name:string;email:string}|null>(null)
 const [login,setLogin]=useState({email:'',password:''})
 const [authMsg,setAuthMsg]=useState(''),[authBusy,setAuthBusy]=useState(false)

 useEffect(()=>{
  if(!getToken())return
  ;(async()=>{
   try{const me=await api.get<any>('/api/auth/me');setSession({name:me.name,email:me.email});setProfile((p:any)=>({...p,name:me.name,email:me.email,...(me.profile||{})}))}catch{setToken(null)}
  })()
 },[])

 function update(key:string,value:string){setProfile({...profile,[key]:value})}

 async function savePreferences(){
  if(getToken()){
   try{
    await api.put('/api/auth/me',{name:profile.name,profile:{state:profile.state,board:profile.board,medium:profile.medium,grades:profile.grades,subjects:profile.subjects,language:profile.language,school:profile.school}})
   }catch{}
  }
  setSaved(true);setTimeout(()=>setSaved(false),2500)
 }

 async function signin(e:React.FormEvent){
  e.preventDefault();setAuthMsg('');setAuthBusy(true)
  try{
   const r=await api.post<any>('/api/auth/login',{email:login.email,password:login.password})
   setToken(r.token);setSession({name:r.name,email:login.email});setProfile((p:any)=>({...p,name:r.name,email:login.email}))
  }catch(err:any){setAuthMsg(err.message||'Sign-in failed.')}
  finally{setAuthBusy(false)}
 }

 async function signout(){setToken(null);setSession(null);setLogin({email:'',password:''})}

 return <Layout title="My profile">
  <div className="page-heading"><div><div className="eyebrow">YOUR TEACHING CONTEXT</div><h1>Make THRIVE fit your classroom.</h1><p>This context tailors the assistant, compiler and training suggestions.</p></div></div>
  <div className="profile-layout">
   <aside className="panel profile-hero">
    <div className="profile-photo">{(profile.name||'T').trim()[0]?.toUpperCase()}</div>
    <h2>{profile.name||'Teacher'}</h2>
    <p>{profile.state||'State not set'} · {profile.board||'Curriculum not set'}</p>
    <div className="divider"/>
    {session?<div>
     <div className="tag" style={{marginBottom:8}}>Signed in</div>
     <div className="muted" style={{fontSize:9,marginBottom:8}}>{session.email}</div>
     <button className="btn btn-small" onClick={signout}>Sign out</button>
    </div>:<form onSubmit={signin}>
     <div className="field"><label>Email</label><input type="email" value={login.email} onChange={e=>setLogin({...login,email:e.target.value})} placeholder="you@school.in"/></div>
     <div className="field"><label>Password</label><input type="password" value={login.password} onChange={e=>setLogin({...login,password:e.target.value})} placeholder="••••••"/></div>
     {authMsg&&<div className="notice" style={{background:'#fbefec',borderColor:'#f2d8d0',color:'#925e4d',marginBottom:8}}>{authMsg}</div>}
     <button className="btn btn-primary btn-small" type="submit" disabled={authBusy} style={{width:'100%',justifyContent:'center'}}>{authBusy?'Signing in…':'Sign in'}</button>
     <div style={{marginTop:8,fontSize:9}}><a className="text-link" href="/signup">Create an account →</a></div>
    </form>}
    <div className="divider"/>
    <div className="notice" style={{textAlign:'left'}}>No student information is needed. Avoid entering identifiable student data anywhere in THRIVE.</div>
   </aside>
   <section className="panel">
    <div className="panel-title"><div><h2>Teacher profile</h2><p>Used by your teaching assistant and planner</p></div></div>
    <div className="form-grid">
     <div className="field"><label>Your name</label><input value={profile.name} onChange={e=>update('name',e.target.value)}/></div>
     <div className="field"><label>Email</label><input type="email" value={profile.email} onChange={e=>update('email',e.target.value)} placeholder="optional"/></div>
     <div className="field"><label>State</label><select value={profile.state} onChange={e=>update('state',e.target.value)}>{['Bihar','Delhi','Uttar Pradesh','Madhya Pradesh','Rajasthan','Other'].map(x=><option key={x}>{x}</option>)}</select></div>
     <div className="field"><label>Board / curriculum</label><select value={profile.board} onChange={e=>update('board',e.target.value)}>{['Bihar SCERT','NCERT','State curriculum — other','Other'].map(x=><option key={x}>{x}</option>)}</select></div>
     <div className="field"><label>Medium(s) of instruction</label><select value={profile.medium} onChange={e=>update('medium',e.target.value)}>{['Hindi + English','Hindi','English','Other'].map(x=><option key={x}>{x}</option>)}</select></div>
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
  </div>
 </Layout>
}
