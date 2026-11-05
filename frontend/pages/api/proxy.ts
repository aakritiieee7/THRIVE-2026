import type { NextApiRequest, NextApiResponse } from 'next'
import fetch from 'node-fetch'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const url = `http://localhost:8000${req.url?.replace('/api','')}`
  const method = req.method ?? 'GET'
  const headers: any = { 'Content-Type': 'application/json' }
  const body = req.method === 'GET' ? undefined : JSON.stringify(req.body)
  const r = await fetch(url, { method, headers, body })
  const data = await r.text()
  res.status(r.status).send(data)
}
