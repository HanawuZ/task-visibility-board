// GitHub API access. Requests go to /gh/* on the Vite server, which forwards
// them to api.github.com and adds the token from .env.local (see vite.config.js).
import { DEMO } from './demo.js'
import { monthRange, qualName, quoteVal, txt } from './util.js'

const GQL = '/gh/graphql'
const REST = '/gh'

const netErr = () => {
  throw new Error('เชื่อมต่อ GitHub ไม่ได้ ตรวจอินเทอร์เน็ต หรือดูว่า dev server ยังทำงานอยู่')
}

function httpErr(status, j, org) {
  const m = (j && j.message) || ''
  let e
  if (status === 401) e = new Error('token ไม่ถูกต้องหรือหมดอายุ ตรวจ FLOW_GITHUB_TOKEN ใน .env.local')
  else if (/SAML|SSO/i.test(m)) e = new Error('org นี้เปิด SSO ต้องไปที่หน้า token แล้วกด Configure SSO → Authorize ให้ ' + org)
  else if (/rate limit/i.test(m)) e = new Error('เรียก GitHub ถี่เกินไป (rate limit) รอสักครู่แล้วลองใหม่')
  else if (status === 403) e = new Error('token ไม่มีสิทธิ์ (ต้องมี read:project และ repo) ' + m)
  else if (status === 404) e = new Error('ไม่พบข้อมูล หรือ token มองไม่เห็น project นี้')
  else e = new Error('GitHub ตอบกลับ ' + status + (m ? ': ' + m : ''))
  e.status = status
  return e
}

async function gql(query, variables, org) {
  let r
  try {
    r = await fetch(GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: variables || {} }),
    })
  } catch {
    netErr()
  }
  const j = await r.json().catch(() => null)
  if (!r.ok) throw httpErr(r.status, j, org)
  if (j && j.errors && j.errors.length) {
    const e = j.errors[0], m = e.message || ''
    if (e.type === 'INSUFFICIENT_SCOPES') throw new Error('token สิทธิ์ไม่พอ ต้องมี read:project (และ repo ถ้า repo เป็น private)')
    if (/SAML|SSO/i.test(m)) throw new Error('org นี้เปิด SSO ต้องไปที่หน้า token แล้วกด Configure SSO → Authorize ให้ ' + org)
    if (/Could not resolve to an Organization/i.test(m)) throw new Error('ไม่พบ organization "' + org + '" หรือ token มองไม่เห็น org นี้')
    if (!j.data) throw new Error(m)
  }
  return j.data
}

function nextLink(h) {
  if (!h) return null
  for (const p of h.split(',')) {
    if (/rel="next"/.test(p)) return p.slice(p.indexOf('<') + 1, p.indexOf('>')).replace('https://api.github.com', REST)
  }
  return null
}

async function rest(pathOrUrl, org) {
  const url = pathOrUrl.startsWith(REST + '/') ? pathOrUrl : REST + pathOrUrl
  let r
  try {
    r = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } })
  } catch {
    netErr()
  }
  const j = await r.json().catch(() => null)
  if (!r.ok) throw httpErr(r.status, j, org)
  return { data: j, next: nextLink(r.headers.get('Link')) }
}

/* 1) projects list (GraphQL) */
const Q_PROJECTS =
  'query($org:String!,$after:String){organization(login:$org){projectsV2(first:50,after:$after,orderBy:{field:UPDATED_AT,direction:DESC}){nodes{id number title closed updatedAt url shortDescription} pageInfo{hasNextPage endCursor}}}}'

export async function fetchProjects(org, demo) {
  if (demo) return DEMO.projects
  let all = [], after = null
  for (;;) {
    const d = await gql(Q_PROJECTS, { org, after }, org)
    if (!d || !d.organization) throw new Error('ไม่พบ organization "' + org + '"')
    const c = d.organization.projectsV2
    all = all.concat(c.nodes.filter(Boolean))
    if (!c.pageInfo.hasNextPage || all.length >= 300) return all
    after = c.pageInfo.endCursor
  }
}

/* 2) fields only (fast) — REST, GraphQL fallback. Returns { fields, restOK }. */
const Q_FIELDS =
  'query($id:ID!){node(id:$id){... on ProjectV2{fields(first:50){nodes{... on ProjectV2FieldCommon{name dataType} ... on ProjectV2SingleSelectField{options{name}}}}}}}'

export async function fetchFields(org, project, demo) {
  if (demo) return { fields: DEMO.fields, restOK: true }
  try {
    const res = await rest('/orgs/' + encodeURIComponent(org) + '/projectsV2/' + project.number + '/fields?per_page=100', org)
    const fields = (res.data || []).map((f) => ({
      id: f.id,
      name: f.name,
      type: String(f.data_type || '').toLowerCase(),
      options: (f.options || []).map(txt).filter(Boolean),
    }))
    return { fields, restOK: true }
  } catch (er) {
    if (er.status !== 404 && er.status !== 410) throw er
    const d = await gql(Q_FIELDS, { id: project.id }, org)
    const fields = ((d.node && d.node.fields.nodes) || [])
      .filter((f) => f && f.name)
      .map((f) => ({ id: null, name: f.name, type: String(f.dataType || '').toLowerCase(), options: (f.options || []).map((o) => o.name) }))
    return { fields, restOK: false }
  }
}

/* 3) items — REST with server-side filter (q), GraphQL full load as fallback */
export function buildQuery(map, month) {
  const parts = [], r = monthRange(month)
  if (map.target && map.target.startsWith('date:')) parts.push(qualName(map.target.slice(5)) + ':' + r.first + '..' + r.last)
  if (map.product && map.products.length) parts.push(qualName(map.product) + ':' + map.products.map(quoteVal).join(','))
  return parts.join(' ')
}

function fieldIds(map, fields) {
  const want = {}, ids = []
  ;[map.start, map.end, map.target].forEach((s) => { if (s) want[s.slice(s.indexOf(':') + 1)] = true })
  if (map.status) want[map.status] = true
  if (map.product) want[map.product] = true
  fields.forEach((f) => { if (f.id != null && (want[f.name] || f.type === 'assignees' || f.type === 'title')) ids.push(f.id) })
  return ids
}

function normRest(it) {
  const c = it.content || {}, fv = {}
  let ppl = null, title = c.title || null
  const url = c.html_url || null
  ;(it.fields || []).forEach((f) => {
    const t = String(f.data_type || '').toLowerCase(), v = f.value
    if (v == null) return
    if (t === 'date') { const d = typeof v === 'object' ? v.date || v.value || '' : v; if (d) fv[f.name] = String(d).slice(0, 10) }
    else if (t === 'single_select') fv[f.name] = txt(v)
    else if (t === 'iteration') fv[f.name] = { startDate: String(v.start_date || v.startDate || '').slice(0, 10), duration: v.duration }
    else if (t === 'assignees') ppl = (Array.isArray(v) ? v : []).map((u) => u && u.login).filter(Boolean)
    else if (t === 'title') { if (!title) title = txt(v) }
    else fv[f.name] = txt(v)
  })
  if (!ppl) ppl = (c.assignees || []).map((u) => u && u.login).filter(Boolean)
  let ref = ''
  if (url) { const mm = url.match(/github\.com\/[^/]+\/([^/]+)\/(?:issues|pull)\/(\d+)/); if (mm) ref = mm[1] + '#' + mm[2] }
  return { id: it.id, archived: !!it.archived_at, title: title || '(ไม่มีชื่อ)', url, ref, people: ppl.sort(), cstate: c.state || null, merged: !!c.merged_at, fv }
}

const Q_ITEMS =
  'query($id:ID!,$after:String){node(id:$id){... on ProjectV2{' +
  ' items(first:100,after:$after){pageInfo{hasNextPage endCursor} nodes{id isArchived' +
  ' content{__typename ... on Issue{title number url state repository{name} assignees(first:10){nodes{login}}} ... on PullRequest{title number url state repository{name} assignees(first:10){nodes{login}}} ... on DraftIssue{title assignees(first:10){nodes{login}}}}' +
  ' fieldValues(first:50){nodes{__typename' +
  ' ... on ProjectV2ItemFieldDateValue{date field{... on ProjectV2FieldCommon{name}}}' +
  ' ... on ProjectV2ItemFieldSingleSelectValue{name field{... on ProjectV2FieldCommon{name}}}' +
  ' ... on ProjectV2ItemFieldIterationValue{startDate duration field{... on ProjectV2FieldCommon{name}}}' +
  ' ... on ProjectV2ItemFieldTextValue{text field{... on ProjectV2FieldCommon{name}}}' +
  '}}}}}}}'

function normGql(n) {
  const c = n.content || {}, fv = {}
  ;((n.fieldValues && n.fieldValues.nodes) || []).forEach((v) => {
    if (!v || !v.field || !v.field.name) return
    if (v.__typename === 'ProjectV2ItemFieldDateValue') fv[v.field.name] = v.date
    else if (v.__typename === 'ProjectV2ItemFieldSingleSelectValue') fv[v.field.name] = v.name
    else if (v.__typename === 'ProjectV2ItemFieldIterationValue') fv[v.field.name] = { startDate: v.startDate, duration: v.duration }
    else if (v.__typename === 'ProjectV2ItemFieldTextValue') fv[v.field.name] = v.text
  })
  return {
    id: n.id, archived: !!n.isArchived, title: c.title || '(ไม่มีชื่อ)', url: c.url || null,
    ref: c.number ? (c.repository ? c.repository.name : '') + '#' + c.number : '',
    people: ((c.assignees && c.assignees.nodes) || []).filter(Boolean).map((u) => u.login).sort(),
    cstate: c.state || null, merged: c.state === 'MERGED', fv,
  }
}

async function loadRest({ org, project, fields, map }, q, onProgress) {
  const ids = fieldIds(map, fields)
  let out = [], n = 0
  let url = '/orgs/' + encodeURIComponent(org) + '/projectsV2/' + project.number + '/items?per_page=100' +
    (q ? '&q=' + encodeURIComponent(q) : '') + (ids.length ? '&fields=' + ids.join(',') : '')
  while (url) {
    const res = await rest(url, org)
    out = out.concat((res.data || []).map(normRest))
    onProgress?.(out.length)
    url = res.next && n++ < 60 ? res.next : null
  }
  return out
}

async function loadGql({ org, project }, onProgress) {
  let out = [], after = null, n = 0
  for (;;) {
    const d = await gql(Q_ITEMS, { id: project.id, after }, org)
    const p = d && d.node
    if (!p) throw new Error('ไม่พบ project นี้ หรือ token ไม่มีสิทธิ์เปิด')
    out = out.concat(p.items.nodes.filter(Boolean).map(normGql))
    onProgress?.(out.length)
    if (!p.items.pageInfo.hasNextPage || n++ >= 60) return out
    after = p.items.pageInfo.endCursor
  }
}

/** ctx = { org, project, fields, map, month, restOK, demo }. Returns { items, note }. */
export async function loadItems(ctx, onProgress) {
  const q = buildQuery(ctx.map, ctx.month)
  let list, note = ''
  if (ctx.demo) list = DEMO.items.map((x) => JSON.parse(JSON.stringify(x)))
  else if (ctx.restOK) {
    try {
      list = await loadRest(ctx, q, onProgress)
      note = 'กรองที่ GitHub: ' + (q || '(ไม่มีตัวกรอง)')
    } catch (er) {
      if (er.status !== 422 && er.status !== 400) throw er
      note = 'GitHub ไม่รับตัวกรองนี้ เลยโหลดทั้งหมดแล้วกรองในเบราว์เซอร์'
      list = await loadRest(ctx, '', onProgress)
    }
  } else {
    list = await loadGql(ctx, onProgress)
    note = 'โหลดทั้ง project แล้วกรองในเบราว์เซอร์ (REST API ใช้ไม่ได้กับ token นี้)'
  }
  return { items: list.filter((x) => !x.archived), note }
}
