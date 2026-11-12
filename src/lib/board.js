// Field mapping defaults and turning loaded items into board tasks.
import { addDays, monthRange } from './util.js'

const byType = (fields, types) => fields.filter((f) => types.includes(f.type))
function guess(fields, types, re) {
  const f = byType(fields, types).find((x) => re.test(x.name))
  return f ? f.name : ''
}

export function doneGuess(fields, statusName) {
  const st = fields.find((f) => f.name === statusName)
  return st ? st.options.filter((n) => /done|closed|complete|released|deployed|merged|เสร็จ|ปิด/i.test(n)) : []
}

export function defaultMap(fields) {
  const iter = byType(fields, ['iteration'])[0]
  const target = guess(fields, ['date'], /release/i) || guess(fields, ['date'], /target|deploy|launch|ปล่อย|เป้า/i)
  const start = guess(fields, ['date'], /start|begin|เริ่ม/i)
  let end = guess(fields, ['date'], /end|due|finish|deadline|จบ/i)
  if (end === target) end = ''
  const m = {
    target: target ? 'date:' + target : '',
    start: start ? 'date:' + start : iter ? 'iterS:' + iter.name : '',
    end: end ? 'date:' + end : iter && !start ? 'iterE:' + iter.name : '',
    status: guess(fields, ['single_select'], /^status$|สถานะ/i) || guess(fields, ['single_select'], /status/i),
    product: guess(fields, ['single_select'], /product|โปรดักต์|โปรดัก|module|app|ระบบ/i),
    products: [], done: [], names: {}, seen: {},
  }
  m.done = doneGuess(fields, m.status)
  return m
}

function val(sel, fv) {
  if (!sel) return null
  const i = sel.indexOf(':'), kind = sel.slice(0, i), name = sel.slice(i + 1), v = fv[name]
  if (!v) return null
  if (kind === 'date') return typeof v === 'string' ? v.slice(0, 10) : null
  if (!v.startDate) return null
  return kind === 'iterS' ? v.startDate : addDays(v.startDate, Math.max(1, v.duration || 1) - 1)
}

/** Only tasks whose release date falls in `month` and (if chosen) in the selected products. */
export function parseItems(items, map, month) {
  const r = monthRange(month), out = []
  items.forEach((x) => {
    const target = val(map.target, x.fv)
    if (!target || target < r.first || target > r.last) return
    const product = map.product ? x.fv[map.product] || null : null
    if (map.product && map.products.length && !map.products.includes(product)) return
    const start = val(map.start, x.fv)
    let end = val(map.end, x.fv)
    if (start && end && end < start) end = start
    const status = map.status ? x.fv[map.status] || null : null
    const done = /^(closed|merged)$/i.test(x.cstate || '') || !!x.merged // closed issue / merged PR = done
    out.push({ id: x.id, title: x.title, url: x.url, ref: x.ref, people: x.people, status, done, product, start, end, target })
  })
  return out
}
