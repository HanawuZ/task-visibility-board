// Read-only GitHub API proxy shared by the Vite dev server (vite.config.js)
// and the Vercel serverless function (api/gh.js).
// The browser calls /gh/<github path>; the token (FLOW_GITHUB_TOKEN) is added here
// and never sent to the browser.

const API = 'https://api.github.com'

/** Only what the board needs: GraphQL queries + reading the org's Projects v2 over REST. */
function allowed(method, path, body, org) {
  if (method === 'POST') {
    if (path !== '/graphql') return false
    const q = body && typeof body.query === 'string' ? body.query : ''
    return !/\bmutation\b/i.test(q) // queries only, never writes
  }
  if (method !== 'GET') return false
  const m = path.match(/^\/orgs\/([^/]+)\/projectsV2(\/|$)/i)
  return !!m && (!org || m[1].toLowerCase() === org.toLowerCase())
}

/**
 * Handle one proxied request.
 * @param {{method:string, path:string, search:string, body:any, accept?:string}} req  path without the /gh prefix
 * @param {Record<string,string|undefined>} env  FLOW_GITHUB_TOKEN, GITHUB_OWNER
 * @returns {Promise<{status:number, headers:Record<string,string>, body:string}>}
 */
export async function handleGh(req, env) {
  const token = env.FLOW_GITHUB_TOKEN || ''
  const org = env.GITHUB_OWNER || ''
  const json = (status, obj) => ({ status, headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(obj) })

  // Lets the page show whether the server has a token, without exposing it.
  if (req.path === '/_status') return json(200, { tokenSet: !!token, org })
  if (!token) return json(401, { message: 'FLOW_GITHUB_TOKEN is not set on the server' })
  if (!allowed(req.method, req.path, req.body, org)) return json(403, { message: 'read-only proxy: request not allowed' })

  const res = await fetch(API + req.path + (req.search || ''), {
    method: req.method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: req.accept || 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'task-visibility-board',
      ...(req.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    body: req.method === 'POST' ? JSON.stringify(req.body || {}) : undefined,
  })

  const headers = { 'content-type': res.headers.get('content-type') || 'application/json' }
  for (const h of ['link', 'x-github-sso', 'x-ratelimit-remaining']) {
    const v = res.headers.get(h)
    if (v) headers[h] = v
  }
  return { status: res.status, headers, body: await res.text() }
}

/** Read a JSON body from a Node request stream (Vite dev server). */
export function readJson(req) {
  return new Promise((resolve) => {
    let s = ''
    req.on('data', (c) => { s += c })
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : null) } catch { resolve(null) } })
    req.on('error', () => resolve(null))
  })
}
