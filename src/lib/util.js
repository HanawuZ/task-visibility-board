export const TH_M = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
export const TH_MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
export const TH_DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
export const TH_DOW_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์', 'เสาร์']
export const REFRESH_MIN = 10

export const LS = {
  get(k) {
    try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage unavailable */ }
  },
}

export const utc = (iso) => { const p = iso.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) }
export const isoOf = (ms) => new Date(ms).toISOString().slice(0, 10)
export const addDays = (iso, n) => isoOf(utc(iso) + n * 864e5)
export const fmt = (iso) => { const p = iso.split('-'); return +p[2] + ' ' + TH_MS[+p[1] - 1] }
export const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 864e5)

export function todayISO() {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

export function relTxt(iso) {
  const n = daysBetween(todayISO(), iso)
  if (n === 0) return 'วันนี้'
  if (n === 1) return 'พรุ่งนี้'
  if (n > 1) return 'อีก ' + n + ' วัน'
  if (n === -1) return 'เมื่อวาน'
  return 'เลยมา ' + -n + ' วัน'
}

export function monthRange(m) {
  const y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1
  return { first: isoOf(Date.UTC(y, mo, 1)), last: isoOf(Date.UTC(y, mo + 1, 0)) }
}

export function txt(v) {
  if (v == null) return null
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (v.raw != null) return String(v.raw)
  if (v.name != null) return txt(v.name)
  if (v.title != null) return txt(v.title)
  return null
}
export const qualName = (name) => String(name).trim().toLowerCase().replace(/\s+/g, '-')
export const quoteVal = (v) => '"' + String(v).replace(/"/g, '') + '"'
