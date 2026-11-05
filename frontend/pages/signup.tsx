import { useState } from 'react'
import axios from 'axios'
import Layout from '../components/Layout'

export default function Signup(){
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')

  async function submit(){
    const r = await axios.post('/api/auth/signup',{name,email})
    setMsg('Signed up: ' + JSON.stringify(r.data))
  }

  return (
    <Layout>
      <div className="bg-white p-6 rounded-xl shadow max-w-md">
        <h2 className="text-2xl font-semibold mb-4">Sign up - THRIVE</h2>
        <label className="block text-sm text-gray-600">Name</label>
        <input className="mt-1 p-2 w-full border rounded" value={name} onChange={(e)=>setName(e.target.value)} />
        <label className="block text-sm text-gray-600 mt-3">Email</label>
        <input className="mt-1 p-2 w-full border rounded" value={email} onChange={(e)=>setEmail(e.target.value)} />
        <div className="mt-4">
          <button onClick={submit} className="px-4 py-2 bg-accent text-white rounded">Sign up</button>
        </div>
        <div className="mt-4 text-sm text-green-600">{msg}</div>
      </div>
    </Layout>
  )
}
