import { useState } from 'react'
import { fmt } from '../lib/util.js'
import Steps from './Steps.jsx'

export default function ConnectView({ org, setOrg, tokenSet, msg, busy, projects, onLoad, onDemo, onOpen }) {
  const [showClosed, setShowClosed] = useState(false)
  const list = projects ? projects.filter((p) => showClosed || !p.closed) : null

  return (
    <div className="wrap narrow">
      <header>
        <div>
          <p className="eyebrow">Release board · GitHub Projects</p>
          <h1>เชื่อมต่อ GitHub</h1>
        </div>
        <Steps on={1} />
      </header>

      <form className="panel" noValidate onSubmit={(e) => { e.preventDefault(); onLoad() }}>
        <label className="fld">
          <span>Organization</span>
          <input className="in" value={org} onChange={(e) => setOrg(e.target.value)} autoComplete="off" spellCheck="false" placeholder="เช่น Solution-Dev3" />
        </label>
        <div className="fld">
          <span>Personal access token</span>
          <div className={'msg ' + (tokenSet ? 'info' : 'err')}>
            {tokenSet
              ? <>ใช้ token จาก <code>FLOW_GITHUB_TOKEN</code> ใน <code>.env.local</code> (อยู่ที่ dev server ไม่ถูกส่งมาที่เบราว์เซอร์)</>
              : <>ยังไม่ได้ตั้ง <code>FLOW_GITHUB_TOKEN</code> ใน <code>.env.local</code> — ใส่แล้วรีสตาร์ท dev server</>}
          </div>
        </div>
        <details className="help">
          <summary>ต้องใช้ token สิทธิ์อะไร</summary>
          <ul>
            <li><b>Classic token:</b> ติ๊ก <code>read:project</code> และ <code>repo</code> (ถ้า issue อยู่ใน repo private)</li>
            <li><b>Fine-grained token:</b> Resource owner = org นี้ · Organization permissions → <code>Projects: Read</code> · Repository permissions → <code>Issues</code> และ <code>Pull requests: Read</code></li>
            <li>ถ้า org เปิด SSO ต้องกด <b>Configure SSO → Authorize</b> ให้ token ด้วย</li>
          </ul>
        </details>
        <div className="row">
          <button type="submit" className="btn primary" disabled={busy}>โหลดรายการ Project</button>
          <button type="button" className="btn" onClick={onDemo}>ลองด้วยข้อมูลตัวอย่าง</button>
        </div>
        {msg?.text && <div className={'msg ' + (msg.kind || 'info')} aria-live="polite">{msg.text}</div>}
      </form>

      {list && (
        <section>
          <div className="sec-head">
            <h2>เลือก Project</h2>
            <label className="check">
              <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> แสดง project ที่ปิดแล้ว
            </label>
          </div>
          <div className="plist">
            {!list.length && <div className="empty">ไม่พบ project ที่ token นี้มองเห็น</div>}
            {list.map((p) => (
              <button key={p.id} type="button" className={'pcard' + (p.closed ? ' closed' : '')} onClick={() => onOpen(p)}>
                <b>{p.title}</b>
                <span>#{p.number} · อัปเดต {fmt(p.updatedAt.slice(0, 10))}{p.closed ? ' · ปิดแล้ว' : ''}</span>
                {p.shortDescription && <span>{p.shortDescription}</span>}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
