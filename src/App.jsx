import { useCallback, useEffect, useRef, useState } from 'react'
import ConnectView from './views/ConnectView.jsx'
import SetupView from './views/SetupView.jsx'
import BoardView from './views/BoardView.jsx'
import { fetchFields, fetchProjects, getStatus, loadItems } from './lib/github.js'
import { defaultMap, parseItems } from './lib/board.js'
import { DEMO } from './lib/demo.js'
import { LS, REFRESH_MIN, TH_M, todayISO } from './lib/util.js'

const DEFAULT_ORG = 'Solution-Dev3'

// Views: connect (org → project) → setup (product + release month + field mapping) → board.
export default function App() {
  const saved = useRef(LS.get('ghrb-conn') || {}).current
  const [view, setView] = useState('connect')
  const [loadingText, setLoadingText] = useState('')
  const [org, setOrg] = useState(saved.org || DEFAULT_ORG)
  const [server, setServer] = useState(null) // { reachable, tokenSet, org } from /gh/_status
  const [demo, setDemo] = useState(false)
  const [projects, setProjects] = useState(null)
  const [busy, setBusy] = useState(false)
  const [connectMsg, setConnectMsg] = useState(null)
  const [setupErr, setSetupErr] = useState('')

  // everything needed to (re)load the board
  const [ctx, setCtx] = useState(null) // { org, project, fields, restOK, demo }
  const [map, setMapState] = useState(null)
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const [items, setItems] = useState([])
  const [fetchedAt, setFetchedAt] = useState(null)
  const [loadNote, setLoadNote] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshErr, setRefreshErr] = useState('')

  const loading = (t) => { setLoadingText(t || 'กำลังโหลดข้อมูลจาก GitHub…'); setView('loading'); window.scrollTo(0, 0) }
  const show = (v) => { setView(v); window.scrollTo(0, 0) }

  const setMap = useCallback((m, c = ctx) => {
    setMapState(m)
    if (c && !c.demo) LS.set('ghrb-map-' + c.project.id, m)
  }, [ctx])

  function saveConn(o, p) {
    LS.set('ghrb-conn', { org: o, projectId: p?.id || null, projectNumber: p?.number || null, projectTitle: p?.title || null, projectUrl: p?.url || null })
  }

  /** Load items for the given settings; records who appears on the board for colour assignment. */
  async function fetchBoard(c, m, mon, onProgress) {
    const res = await loadItems({ ...c, map: m, month: mon }, onProgress)
    const seen = {}
    parseItems(res.items, m, mon).forEach((x) => x.people.forEach((l) => { seen[l] = true }))
    const m2 = { ...m, seen }
    setItems(res.items)
    setLoadNote(res.note)
    setFetchedAt(new Date())
    setMap(m2, c)
  }

  async function loadAndShow(c = ctx, m = map, mon = month) {
    loading('กำลังโหลดงานที่ release ' + TH_M[+mon.slice(5, 7) - 1] + ' ' + mon.slice(0, 4) + '…')
    try {
      await fetchBoard(c, m, mon, (n) => setLoadingText('กำลังโหลดงานจาก GitHub… (' + n + ' รายการ)'))
      setRefreshErr('')
      show('board')
    } catch (er) {
      setSetupErr(er.message)
      show('setup')
    }
  }

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await fetchBoard(ctx, map, month)
      setRefreshErr('')
    } catch (er) {
      setRefreshErr(er.message)
    } finally {
      setRefreshing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, map, month])

  // auto refresh while the board is visible
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  useEffect(() => {
    if (view !== 'board' || demo) return
    const id = setInterval(() => { if (!document.hidden) refreshRef.current() }, REFRESH_MIN * 60000)
    return () => clearInterval(id)
  }, [view, demo])

  async function openProject(p, isDemo = demo, o = org) {
    loading('กำลังอ่าน field ของ ' + p.title + '…')
    try {
      const { fields, restOK } = await fetchFields(o, p, isDemo)
      const c = { org: o, project: p, fields, restOK, demo: isDemo }
      const savedMap = !isDemo && LS.get('ghrb-map-' + p.id)
      const m = { ...(savedMap || defaultMap(fields)) }
      m.products ||= []
      m.names ||= {}
      m.seen ||= {}
      if (isDemo) { m.names = DEMO.names; m.seen = {} }
      setCtx(c)
      setMapState(m)
      if (!isDemo) saveConn(o, p)
      setSetupErr('')
      show('setup')
      return { c, m }
    } catch (er) {
      show('connect')
      setConnectMsg({ text: er.message, kind: 'err' })
      return null
    }
  }

  async function onLoadProjects() {
    const o = org.trim()
    setDemo(false)
    if (!o) return setConnectMsg({ text: 'ใส่ชื่อ organization ก่อน', kind: 'err' })
    setOrg(o)
    setBusy(true)
    setConnectMsg({ text: 'กำลังโหลดรายการ project…', kind: 'info' })
    try {
      const ps = await fetchProjects(o, false)
      setProjects(ps)
      saveConn(o, null)
      setConnectMsg(null)
    } catch (er) {
      setConnectMsg({ text: er.message, kind: 'err' })
    } finally {
      setBusy(false)
    }
  }

  async function onDemo() {
    setDemo(true)
    setOrg('demo-org')
    setMonth('2026-11')
    setProjects(await fetchProjects('demo-org', true))
    setConnectMsg({ text: 'โหมดตัวอย่าง: ข้อมูลไม่ได้มาจาก GitHub จริง', kind: 'info' })
  }

  // start: reopen the last project (and board, if a release field was already chosen)
  useEffect(() => {
    getStatus().then((s) => {
      setServer(s)
      const o = saved.org || s.org || DEFAULT_ORG
      setOrg(o)
      if (!s.tokenSet || !saved.projectId || !saved.projectNumber) return
      const p = { id: saved.projectId, number: saved.projectNumber, title: saved.projectTitle || 'project', url: saved.projectUrl || null }
      openProject(p, false, o).then((r) => { if (r && r.m.target) loadAndShow(r.c, r.m, month) })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (view === 'loading') {
    return (
      <div className="wrap narrow">
        <div className="panel"><p style={{ margin: 0 }}><span className="spinner" /> {loadingText}</p></div>
      </div>
    )
  }
  if (view === 'setup' && ctx && map) {
    return (
      <SetupView demo={demo} org={ctx.org} project={ctx.project} fields={ctx.fields} map={map} setMap={(m) => setMap(m)}
        month={month} setMonth={setMonth} err={setupErr} setErr={setSetupErr}
        onBack={() => show('connect')} onBoard={() => loadAndShow()} />
    )
  }
  if (view === 'board' && ctx && map) {
    return (
      <BoardView key={ctx.project.id} demo={demo} org={ctx.org} project={ctx.project} map={map} month={month} items={items}
        fetchedAt={fetchedAt} loadNote={loadNote} refreshing={refreshing} refreshErr={refreshErr} onRefresh={refresh}
        onSetup={() => show('setup')} onMonth={(m) => { setMonth(m); loadAndShow(ctx, map, m) }} />
    )
  }
  return (
    <ConnectView org={org} setOrg={setOrg} server={server} msg={connectMsg} busy={busy} projects={projects}
      onLoad={onLoadProjects} onDemo={onDemo} onOpen={(p) => openProject(p)} />
  )
}
