import { useRef } from 'react'
import { buildQuery } from '../lib/github.js'
import { doneGuess } from '../lib/board.js'
import Steps from './Steps.jsx'

function DateSelect({ fields, value, onChange, allowIter, bad, inputRef }) {
  return (
    <select ref={inputRef} className={'in' + (bad ? ' bad' : '')} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— ไม่ใช้ —</option>
      {fields.map((f) => [
        f.type === 'date' && <option key={'d' + f.name} value={'date:' + f.name}>{f.name} (วันที่)</option>,
        allowIter && f.type === 'iteration' && <option key={'s' + f.name} value={'iterS:' + f.name}>{f.name} → วันเริ่ม sprint</option>,
        allowIter && f.type === 'iteration' && <option key={'e' + f.name} value={'iterE:' + f.name}>{f.name} → วันจบ sprint</option>,
      ])}
    </select>
  )
}

function SingleSelect({ fields, value, onChange }) {
  return (
    <select className="in" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— ไม่ใช้ —</option>
      {fields.filter((f) => f.type === 'single_select').map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
    </select>
  )
}

export default function SetupView({ demo, org, project, fields, map, setMap, month, setMonth, err, setErr, onBack, onBoard }) {
  const targetRef = useRef(null)
  const set = (patch) => setMap({ ...map, ...patch })
  const pf = fields.find((f) => f.name === map.product)
  const q = buildQuery(map, month)

  function toBoard() {
    if (!map.target) {
      setErr('เลือก field วัน release ก่อน บอร์ดนี้แสดงเฉพาะงานที่มีวัน release')
      targetRef.current?.focus()
      return
    }
    setErr('')
    onBoard()
  }

  return (
    <div className="wrap narrow">
      <header>
        <div>
          <p className="eyebrow">{(demo ? 'ตัวอย่าง' : org) + ' · Project #' + project.number}</p>
          <h1>{project.title}</h1>
        </div>
        <Steps on={2} />
      </header>
      {err && <div className="msg err" aria-live="polite">{err}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="panel key">
          <h2>โหลดอะไร</h2>
          <div className="grid2">
            <label className="fld">
              <span>เดือนที่ release</span>
              <input className="in" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
            </label>
            <label className="fld">
              <span>Field วัน release (ต้องมี)</span>
              <DateSelect fields={fields} value={map.target} onChange={(v) => set({ target: v })} allowIter bad={!!err && !map.target} inputRef={targetRef} />
            </label>
          </div>
          <label className="fld">
            <span>Field ที่บอก product</span>
            <SingleSelect fields={fields} value={map.product} onChange={(v) => set({ product: v, products: [] })} />
          </label>
          {pf ? (
            <>
              <div className="prodgrid">
                {pf.options.map((o) => (
                  <label key={o} className="check">
                    <input
                      type="checkbox"
                      checked={map.products.includes(o)}
                      onChange={(e) => set({ products: e.target.checked ? [...map.products, o] : map.products.filter((x) => x !== o) })}
                    /> {o}
                  </label>
                ))}
              </div>
              <div className="row">
                <button type="button" className="btn link" onClick={() => set({ products: pf.options.slice() })}>เลือกทั้งหมด</button>
                <button type="button" className="btn link" onClick={() => set({ products: [] })}>ล้าง</button>
                <span className="help">ไม่ติ๊กเลย = โหลดทุก product</span>
              </div>
            </>
          ) : (
            <p className="help">ยังไม่ได้เลือก field ที่บอก product จะโหลดทุก product</p>
          )}
          <div className="fld">
            <span>ตัวกรองที่จะส่งให้ GitHub</span>
            <div className="qbox">{q || '(ไม่มีตัวกรอง — จะโหลดทั้ง project)'}</div>
          </div>
          <p className="help">โหลดเฉพาะงานที่มีวัน release อยู่ในเดือนที่เลือก และอยู่ใน product ที่ติ๊ก</p>
        </div>

        <div className="panel">
          <h2>ช่วงงาน<small>ใช้วาดแถบบนปฏิทิน</small></h2>
          <div className="grid2">
            <label className="fld"><span>วันเริ่ม</span><DateSelect fields={fields} value={map.start} onChange={(v) => set({ start: v })} allowIter /></label>
            <label className="fld"><span>วันจบ</span><DateSelect fields={fields} value={map.end} onChange={(v) => set({ end: v })} allowIter /></label>
          </div>
          <p className="help">ไม่มีวันเริ่ม = แสดงเฉพาะหมุด release · ไม่มีวันจบ = ถือว่าจบวัน release</p>
        </div>

        <div className="panel">
          <h2>สถานะ</h2>
          <p className="help">เสร็จแล้ว = issue ที่ close แล้ว (PR ที่ merge แล้ว) · รอเริ่ม = ปัก start date แล้วแต่ยังไม่ถึงวัน · กำลังทำ = ยัง open และยังไม่ถึงวัน release · เลยกำหนด = เลยวัน release แล้วแต่ยัง open</p>
          <label className="fld">
            <span>Field สถานะใน project (แสดงเป็นป้ายประกอบเท่านั้น)</span>
            <SingleSelect fields={fields} value={map.status} onChange={(v) => set({ status: v, done: doneGuess(fields, v) })} />
          </label>
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="btn" onClick={onBack}>← เปลี่ยน Project</button>
        <button type="button" className="btn primary" onClick={toBoard}>โหลดบอร์ด →</button>
      </div>
    </div>
  )
}
