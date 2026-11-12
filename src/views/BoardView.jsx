import { useMemo, useState } from 'react'
import { parseItems } from '../lib/board.js'
import { REFRESH_MIN, TH_DOW, TH_DOW_FULL, TH_M, TH_MS, addDays, daysBetween, fmt, isoOf, relTxt, todayISO, utc } from '../lib/util.js'

const NONE = '__none'
const STL = { active: 'กำลังทำ', upcoming: 'รอเริ่ม', done: 'เสร็จแล้ว', overdue: 'เลยกำหนด' }
const sv = (c) => ({ '--c': `var(--${c})`, '--ink': `var(--${c}-ink)`, '--soft': `var(--${c}-soft)` })
const byTarget = (a, b) => (a.target < b.target ? -1 : a.target > b.target ? 1 : 0)
const DateHTML = ({ iso }) => { const p = iso.split('-'); return <>{+p[2]}<span className="m">{TH_MS[+p[1] - 1]}</span></> }

function initial(n) {
  let i = 0
  while (i < n.length - 1 && 'เแโใไ'.includes(n.charAt(i))) i++
  return n.charAt(i).toUpperCase()
}

function Pill({ it }) {
  return (
    <>
      <span className={'pill ' + it.state}>{it.state === 'done' ? '✓ ' : <i />}{STL[it.state]}</span>
      {it.status && <span className="tag">{it.status}</span>}
    </>
  )
}

export default function BoardView({ demo, org, project, map, month, items, fetchedAt, loadNote, refreshing, refreshErr, onRefresh, onSetup, onMonth }) {
  const [shownP, setShownP] = useState({})
  const [shownProd, setShownProd] = useState({})
  const isShownP = (k) => shownP[k] !== false
  const isShownProd = (k) => shownProd[k] !== false

  const today = todayISO()
  const y = +month.slice(0, 4), mo = +month.slice(5, 7) - 1
  const mStart = Date.UTC(y, mo, 1)
  const DAYS = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate()
  const prevDays = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  const FIRST_DOW = new Date(mStart).getUTCDay()
  const dn = (iso) => Math.round((utc(iso) - mStart) / 864e5) + 1
  const tDay = dn(today)
  const dow = (d) => (((d - 1 + FIRST_DOW) % 7) + 7) % 7
  const WD = []
  for (let d = 1; d <= DAYS; d++) { const w = dow(d); if (w !== 0 && w !== 6) WD.push(d) }

  const { tasks, P, order, usedP, prodList } = useMemo(() => {
    const tasks = parseItems(items, map, month)
    tasks.forEach((it) => {
      it.s = it.start || it.target
      it.e = it.end || it.target
      // closed → done · start date in the future → upcoming · release not passed → active · otherwise overdue
      if (it.done) it.state = 'done'
      else if (it.start && it.start > today) it.state = 'upcoming'
      else if (it.target >= today) it.state = 'active'
      else it.state = 'overdue'
    })
    const logins = {}
    tasks.forEach((it) => it.people.forEach((l) => { logins[l] = true }))
    const order = Object.keys(logins).sort()
    const allSeen = Object.keys(map.seen || {}).sort()
    const P = {}
    order.forEach((l) => { const i = allSeen.indexOf(l); P[l] = { name: map.names[l] || l, color: 't' + (((i < 0 ? 0 : i) % 8) + 1) } })
    P[NONE] = { name: 'ยังไม่มีคนรับ', color: 't0' }
    const usedP = order.slice()
    if (tasks.some((it) => !it.people.length)) usedP.push(NONE)
    const prods = {}
    if (map.product) tasks.forEach((it) => { prods[it.product || NONE] = true })
    const prodList = Object.keys(prods).sort((a, b) => (a === NONE ? 1 : b === NONE ? -1 : a.localeCompare(b)))
    return { tasks, P, order, usedP, prodList }
  }, [items, map, month, today])

  const pkey = (it) => (it.people.length ? it.people : [NONE])
  const colorOf = (it) => P[pkey(it)[0]].color
  const who = (it) => (it.people.length ? it.people.map((l) => P[l].name).join(' & ') : 'ยังไม่มีคนรับ')
  const Av = ({ l, lg }) => <span className={'av' + (lg ? ' lg' : '')} style={sv(P[l].color)} title={P[l].name}>{initial(P[l].name)}</span>
  const Avs = ({ it }) => <span className="avs">{pkey(it).map((l) => <Av key={l} l={l} />)}</span>

  const vis = tasks.filter((it) => pkey(it).some(isShownP) && (!map.product || isShownProd(it.product || NONE)))
  const stamp = fetchedAt ? fetchedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''
  const prodTxt = map.product ? (map.products.length ? map.products.join(', ') : 'ทุก product') : ''
  const count = (st) => vis.filter((it) => it.state === st).length

  /* ---------- summary ---------- */
  const open = vis.filter((it) => !it.done)
  const nexts = open.filter((it) => it.target >= today).sort(byTarget)
  const next = nexts[0]
  const sameDay = next ? nexts.filter((x) => x.target === next.target).length : 0
  const due = open.filter((it) => it.target <= addDays(today, 7)).sort(byTarget).slice(0, 8)

  /* ---------- calendar ---------- */
  const weeks = []
  const evs = vis.map((it) => { const s = dn(it.s), e = dn(it.e); return { it, s: Math.min(s, e), e: Math.max(s, e) } })
  const tagDays = {}
  vis.forEach((it) => { tagDays[dn(it.target)] = true })
  for (let ws = 1 - FIRST_DOW; ws <= DAYS; ws += 7) {
    const cells = []
    for (let i = 0; i < 7; i++) {
      const d = ws + i, out = d < 1 || d > DAYS, we = i === 0 || i === 6
      const label = d < 1 ? prevDays + d : d > DAYS ? d - DAYS : d
      cells.push(<div key={'c' + i} className={'day' + (out ? ' out' : we ? ' we' : '')} style={{ gridColumn: i + 1 }} />)
      cells.push(
        <span key={'n' + i} style={{ gridColumn: i + 1 }}
          className={'dnum' + (out ? ' out' : '') + (!out && we ? ' we' : '') + (!out && !we && d < tDay ? ' past' : '') + (d === tDay ? ' today' : '')}>
          {d === 1 ? <>1<span className="m">{TH_MS[mo]}</span></> : d === DAYS + 1 ? <>1<span className="m">{TH_MS[(mo + 1) % 12]}</span></> : label}
        </span>,
      )
      if (!out && tagDays[d]) cells.push(<span key={'t' + i} className="dtag" style={{ gridColumn: i + 1 }}>◆ Release</span>)
    }
    // multi-day work bars use Mon–Fri only; a one-day task may sit on a weekend, so it uses the whole week
    const mon = Math.max(ws + 1, 1), fri = Math.min(ws + 5, DAYS), segs = []
    evs.forEach((ev) => {
      const one = ev.s === ev.e
      const lo = one ? Math.max(ws, 1) : mon, hi = one ? Math.min(ws + 6, DAYS) : fri
      const s = Math.max(ev.s, lo), e = Math.min(ev.e, hi)
      if (s > e) return
      segs.push({ ev, s, e, cl: ev.s < lo, cr: ev.e > hi })
    })
    segs.sort((a, b) => a.s - b.s || b.e - b.s - (a.e - a.s))
    const lanes = []
    segs.forEach((sg) => {
      let li = 0
      while (lanes[li] != null && lanes[li] >= sg.s) li++
      lanes[li] = sg.e
      const it = sg.ev.it
      let cls = 'ev'
      if (it.done) cls += ' done'
      if (it.state === 'overdue') cls += ' late'
      if (sg.cl) cls += ' cl'
      if (sg.cr) cls += ' cr'
      const Tag = it.url ? 'a' : 'div'
      cells.push(
        <Tag key={'e' + it.id} className={cls} href={it.url || undefined} target={it.url ? '_blank' : undefined} rel={it.url ? 'noopener' : undefined}
          style={{ ...sv(colorOf(it)), gridColumn: `${sg.s - ws + 1} / ${sg.e - ws + 2}`, gridRow: li + 2 }}
          title={`${it.title}${it.ref ? ' (' + it.ref + ')' : ''}\n${who(it)}\nเริ่ม ${it.start ? fmt(it.start) : '-'} · จบ ${it.end ? fmt(it.end) : '-'} · release ${fmt(it.target)}${it.status ? '\nสถานะ: ' + it.status : ''}`}>
          {it.done ? <span className="ck">✓</span> : null}<b>{it.title}</b><span className="who">· {who(it)}</span>
        </Tag>,
      )
    })
    weeks.push(
      <div key={ws} className="week" style={{ gridTemplateRows: `38px repeat(${Math.max(lanes.length, 1)}, 24px) 1fr` }}>{cells}</div>,
    )
  }

  /* ---------- list ---------- */
  const groups = [
    { t: 'เลยกำหนด', st: 'overdue', bad: true }, { t: 'กำลังทำ', st: 'active' },
    { t: 'รอเริ่ม', st: 'upcoming' }, { t: 'เสร็จแล้ว', st: 'done' },
  ].map((g) => ({ ...g, list: vis.filter((it) => it.state === g.st).sort(byTarget) })).filter((g) => g.list.length)

  /* ---------- people ---------- */
  const people = usedP.filter((l) => l !== NONE && isShownP(l)).map((l) => {
    const mine = vis.filter((it) => it.people.includes(l))
    if (!mine.length) return null
    const cur = mine.filter((it) => !it.done && (it.state === 'active' || it.state === 'overdue'))
    const nxt = mine.filter((it) => it.state === 'upcoming').sort((a, b) => (a.s < b.s ? -1 : 1))[0]
    let busyN = 0
    const strip = WD.map((d, i) => {
      const iso = isoOf(mStart + (d - 1) * 864e5)
      const on = mine.filter((it) => it.s <= iso && iso <= it.e)
      if (on.length) busyN++
      return (
        <i key={d} className={(on.length ? 'busy' : '') + (i > 0 && d - WD[i - 1] > 1 ? ' wk1' : '') + (d === tDay ? ' now' : '')}
          title={`${TH_DOW[dow(d)]} ${d} ${TH_MS[mo]} · ${on.length ? on.map((x) => x.title).join(', ') : 'ว่าง'}`} />
      )
    })
    return (
      <div key={l} className="team" style={sv(P[l].color)}>
        <span className="member"><Av l={l} lg />{P[l].name} <small>@{l}</small></span>
        {cur.length ? (
          <div className="slot now">
            <span className="k">ตอนนี้ {cur.length} งาน</span>
            {cur.slice(0, 4).map((it) => (
              <div key={it.id} className="it">
                <span className="t">{it.title}</span>
                <span className={'w' + (it.state === 'overdue' ? ' late' : '')}>
                  {it.state === 'overdue' ? 'เลยกำหนด · release ' + fmt(it.target) : 'release ' + fmt(it.target) + ' · ' + relTxt(it.target)}
                </span>
              </div>
            ))}
            {cur.length > 4 && <span className="w">และอีก {cur.length - 4} งาน</span>}
          </div>
        ) : (
          <div className="slot now idle">
            <span className="k">ตอนนี้</span>
            <span className="t free">ไม่มีงานที่ต้อง release ค้างอยู่</span>
            {nxt && <span className="w">งานถัดไปเริ่ม{relTxt(nxt.s).replace('อีก', ' อีก')}</span>}
          </div>
        )}
        <div className="slot">
          <span className="k">ถัดไป</span>
          {nxt
            ? <><span className="t">{nxt.title}</span><span className="w">เริ่ม {fmt(nxt.s)} · release {fmt(nxt.target)}</span></>
            : <span className="w">ไม่มีงานรอเริ่มในเดือนนี้</span>}
        </div>
        <div>
          <div className="strip" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${WD.length}, minmax(0, 1fr))` }}>{strip}</div>
          <div className="load"><span>มีงาน <b className="num">{busyN}/{WD.length}</b> วัน</span><span>{mine.length} งาน release เดือนนี้</span></div>
        </div>
      </div>
    )
  }).filter(Boolean)

  const goMonth = (delta) => onMonth(isoOf(Date.UTC(y, mo + delta, 1)).slice(0, 7))
  const ChipRow = ({ label, keys, name, color, isOn, toggle }) => (
    <div className="toolbar">
      <span className="lbl">{label}</span>
      {keys.map((k) => (
        <button key={k} type="button" className="chipbtn" aria-pressed={isOn(k)} style={color ? sv(color(k)) : undefined} onClick={() => toggle(k)}>
          <i className="dot" />{name(k)}
        </button>
      ))}
    </div>
  )

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="grp">
          <button type="button" className="btn small" onClick={onSetup}>← เลือก product / ตั้งค่า</button>
          <span className="monthnav">
            <button type="button" aria-label="เดือนก่อน" onClick={() => goMonth(-1)}>‹</button>
            <b>{TH_M[mo]} {y}</b>
            <button type="button" aria-label="เดือนถัดไป" onClick={() => goMonth(1)}>›</button>
          </span>
          <button type="button" className="btn small" onClick={() => onMonth(today.slice(0, 7))}>เดือนนี้</button>
        </div>
        <div className="grp">
          <span className="updated" style={refreshErr ? { color: 'var(--today)' } : undefined}>
            {demo ? 'ข้อมูลตัวอย่าง' : refreshErr ? 'ดึงข้อมูลไม่สำเร็จ: ' + refreshErr : `ดึงจาก GitHub ล่าสุด ${stamp} น. · ดึงใหม่อัตโนมัติทุก ${REFRESH_MIN} นาที`}
          </span>
          {!demo && (
            <button type="button" className="btn small" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? <><span className="spinner" /> กำลังดึง</> : 'ดึงใหม่'}
            </button>
          )}
          {project.url && <a className="btn small" href={project.url} target="_blank" rel="noopener">เปิดใน GitHub ↗</a>}
        </div>
      </div>

      <header>
        <div>
          <p className="eyebrow">Release board · {demo ? 'ตัวอย่าง' : org} · {project.title}</p>
          <h1>Release {TH_M[mo]} {y}</h1>
        </div>
        <p className="meta">
          <span className="tday">วันนี้ <b>{TH_DOW[new Date(utc(today)).getUTCDay()]} {fmt(today)}</b></span>
          {prodTxt && <span>Product: <b>{prodTxt}</b></span>}
          <span><b className="num">{vis.length}</b> งาน · <b className="num">{order.length}</b> คน</span>
        </p>
      </header>

      <section className="summary">
        <div className="spot">
          <p className="eyebrow">Release ถัดไป</p>
          {next ? (
            <div className="spot-top">
              <div className="big">{+next.target.slice(8)}<small>{TH_MS[+next.target.slice(5, 7) - 1]}</small></div>
              <div className="what">
                <strong>{next.title}{sameDay > 1 && <> <span className="tag">+{sameDay - 1} งานวันเดียวกัน</span></>}</strong>
                <div className="row1"><Pill it={next} /><Avs it={next} /><span>{who(next)}</span>{next.product && <span className="tag">{next.product}</span>}</div>
              </div>
              <div className="cd"><b>{relTxt(next.target)}</b>{fmt(next.target)}</div>
            </div>
          ) : (
            <div className="spot-top"><div className="what"><strong>ไม่มี release ที่ยังไม่เสร็จเหลือในเดือนนี้</strong></div></div>
          )}
          {due.length > 0 && (
            <div className="closing">
              <h3>Release ใน 7 วัน และที่เลยกำหนด</h3>
              {due.map((it) => {
                const late = it.target < today, nn = daysBetween(today, it.target)
                return (
                  <div key={it.id} className="cl-row">
                    <span className={'d' + (late ? ' late' : '')}>{fmt(it.target)}</span>
                    <span className="n">{it.title} <span>· {who(it)}</span></span>
                    <span className={'r' + (late || nn <= 1 ? ' soon' : '')}>{relTxt(it.target)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="stats">
          <div className="stat"><div className="lbl"><span className="pill active"><i />กำลังทำ</span></div><div className="v">{count('active')}</div><div className="sub">ยัง open และยังไม่ถึงวัน release</div></div>
          <div className={'stat' + (count('overdue') ? ' bad' : '')}><div className="lbl"><span className="pill overdue"><i />เลยกำหนด</span></div><div className="v">{count('overdue')}</div><div className="sub">เลยวัน release แล้วแต่ยัง open</div></div>
          <div className="stat"><div className="lbl"><span className="pill upcoming"><i />รอเริ่ม</span></div><div className="v">{count('upcoming')}</div><div className="sub">ปัก start date แล้วแต่ยังไม่ถึงวัน</div></div>
          <div className="stat"><div className="lbl"><span className="pill done">✓ เสร็จแล้ว</span></div><div className="v">{count('done')}</div><div className="sub">close แล้ว · จาก {vis.length} งานที่ release เดือนนี้</div></div>
        </div>
      </section>

      <section>
        <div className="sec-head"><h2>ปฏิทิน</h2><p>ลงเฉพาะ จ.–ศ. · คลิกแถบเพื่อเปิด issue ใน GitHub</p></div>
        <div className="filters">
          {usedP.length > 0 && (
            <ChipRow label="คน:" keys={usedP} name={(k) => P[k].name} color={(k) => P[k].color} isOn={isShownP}
              toggle={(k) => setShownP({ ...shownP, [k]: !isShownP(k) })} />
          )}
          {map.product && prodList.length > 1 && (
            <ChipRow label="Product:" keys={prodList} name={(k) => (k === NONE ? '(ไม่ระบุ)' : k)} isOn={isShownProd}
              toggle={(k) => setShownProd({ ...shownProd, [k]: !isShownProd(k) })} />
          )}
        </div>
        <div className="cal-box">
          <div className="cal">
            <div className="dows">{TH_DOW_FULL.map((nm, i) => <div key={nm} className={i === 0 || i === 6 ? 'we' : ''}>{nm}</div>)}</div>
            {weeks}
          </div>
        </div>
        <div className="legend">
          <span><i className="sw solid" />ช่วงงาน (สีตามคน)</span><span><i className="sw tgt" />วัน release</span>
          <span><i className="sw done" />เสร็จแล้ว</span><span><i className="sw late" />เลยกำหนด</span><span><i className="sw today" />วันนี้</span>
        </div>
      </section>

      <section>
        <div className="sec-head"><h2>งานที่ release เดือนนี้</h2><p>เริ่ม · จบ · release</p></div>
        <div className="lbox">
          <div className="lin">
            <div className="lrow lhead">{['งาน · ผู้รับผิดชอบ', 'เริ่ม', 'จบ', 'Release'].map((x) => <div key={x}>{x}</div>)}</div>
            {!groups.length && <div className="empty">ไม่มีงานที่มีวัน release ในเดือนนี้สำหรับตัวกรองที่เลือก</div>}
            {groups.map((g) => [
              <div key={g.st} className={'lgroup' + (g.bad ? ' bad' : '')}>{g.t} <span className="c">{g.list.length}</span></div>,
              ...g.list.map((it) => (
                <div key={it.id} className={'lrow' + (it.done ? ' is-done' : '')}>
                  <div>
                    <div className="name">
                      {it.url ? <a href={it.url} target="_blank" rel="noopener">{it.title}</a> : it.title}
                      {it.ref && <span className="ref">{it.ref}</span>}
                    </div>
                    <div className="sub"><Avs it={it} /><Pill it={it} />{it.product && <span className="tag">{it.product}</span>}</div>
                  </div>
                  <div>
                    {it.start ? <><span className="gdate"><DateHTML iso={it.start} /></span>{it.state === 'upcoming' && <span className="dsub">{relTxt(it.start)}</span>}</> : <span className="none">—</span>}
                  </div>
                  <div>
                    {it.end
                      ? <><span className="gdate"><DateHTML iso={it.end} /></span>{it.state === 'active' && <span className={'dsub' + (daysBetween(today, it.end) <= 1 ? ' soon' : '')}>{relTxt(it.end)}</span>}</>
                      : <span className="none">—</span>}
                  </div>
                  <div className={it.done ? 'rel-ok' : ''}>
                    <span className="gdate"><DateHTML iso={it.target} /></span>
                    {it.done
                      ? <span className="dsub">เสร็จแล้ว</span>
                      : <span className={'dsub' + (it.target < today ? ' late' : daysBetween(today, it.target) <= 1 ? ' soon' : '')}>{relTxt(it.target)}</span>}
                  </div>
                </div>
              )),
            ])}
          </div>
        </div>
      </section>

      <section>
        <div className="sec-head"><h2>ใครถืออะไร</h2><p>นับเฉพาะงานที่ release เดือนนี้ · จุดแดง = วันนี้</p></div>
        <div className="teams">{people.length ? people : <div className="empty">ไม่มีงานของคนที่เลือก</div>}</div>
      </section>

      <ul className="notes">
        <li>แสดงเฉพาะงานที่มีวัน release อยู่ใน{TH_M[mo]} {y}</li>
        <li>เสร็จแล้ว = issue close แล้ว · รอเริ่ม = ปัก start date แล้วแต่ยังไม่ถึงวัน · กำลังทำ = ยัง open และยังไม่ถึงวัน release · เลยกำหนด = เลยวัน release แล้วแต่ยัง open</li>
        {loadNote && !demo && <li>{loadNote}</li>}
        <li>อ่านข้อมูลจาก GitHub อย่างเดียว ไม่แก้ไขอะไรใน project</li>
      </ul>
    </div>
  )
}
