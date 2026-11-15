import fs from 'node:fs'
export const env = {}
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}
export const url = env.VITE_SUPABASE_URL.replace(/\/$/, '')
export const mgmt = (path, init = {}) => fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}${path}`, {
  ...init, headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json', ...(init.headers || {}) } })
export async function sql(query) {
  const r = await mgmt('/database/query', { method: 'POST', body: JSON.stringify({ query }) })
  const text = await r.text()
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text}`)
  return JSON.parse(text)
}
