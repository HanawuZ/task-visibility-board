const LABELS = ['เชื่อมต่อ', 'เลือก product', 'บอร์ด']

export default function Steps({ on }) {
  return (
    <div className="steps">
      {LABELS.map((l, i) => (
        <span key={l} style={{ display: 'contents' }}>
          {i > 0 && <span>→</span>}
          <span className={i + 1 === on ? 'on' : ''}><i className="dot">{i + 1}</i>{l}</span>
        </span>
      ))}
    </div>
  )
}
