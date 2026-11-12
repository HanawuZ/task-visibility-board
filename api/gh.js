// Vercel serverless function behind the rewrite /gh/:path* → /api/gh?path=:path* (see vercel.json).
// Set FLOW_GITHUB_TOKEN (and GITHUB_OWNER) in Vercel → Project → Settings → Environment Variables.
import { handleGh, readJson } from '../server/ghProxy.js'

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const p = url.searchParams.getAll('path').join('/')
  url.searchParams.delete('path')
  const search = url.searchParams.toString()

  let body = null
  if (req.method === 'POST') body = req.body !== undefined ? (typeof req.body === 'string' ? JSON.parse(req.body || 'null') : req.body) : await readJson(req)

  try {
    const out = await handleGh(
      { method: req.method, path: '/' + p.replace(/^\/+/, ''), search: search ? '?' + search : '', body, accept: req.headers.accept },
      process.env,
    )
    res.statusCode = out.status
    for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v)
    res.setHeader('cache-control', 'no-store')
    res.end(out.body)
  } catch (err) {
    res.statusCode = 502
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ message: 'proxy error: ' + err.message }))
  }
}
