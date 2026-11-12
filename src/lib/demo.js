// Sample data for "ลองด้วยข้อมูลตัวอย่าง" — not from GitHub.
// [title, assignees, start, end, release, status, product]
const rows = [
  ['Deploy SSCC', ['fah'], '2026-11-04', '2026-11-04', '2026-11-04', 'Done', 'SSCC'],
  ['Merge & Deploy Chat CC+', ['fah'], '2026-11-05', '2026-11-06', '2026-11-06', 'Done', 'CC+'],
  ['Argento Payment', ['ning', 'tawan'], '2026-11-04', '2026-11-13', '2026-11-18', 'In Progress', 'Argento'],
  ['SSCC – Cutoff time delivery & pickup', ['map', 'rome'], '2026-11-12', '2026-11-16', '2026-11-19', 'In Progress', 'SSCC'],
  ['Fix issue: cart timeout', ['beam', 'tae'], '2026-11-09', '2026-11-10', '2026-11-11', 'In Progress', 'Marketplace'],
  ['Deploy Multi Point', ['fah'], '2026-11-16', '2026-11-20', '2026-11-20', 'Todo', 'Multi Point'],
  ['Cash and Carry (LineOAV2)', ['beam', 'tae'], '2026-11-16', '2026-11-20', '2026-11-24', 'Todo', 'Marketplace'],
  ['Argento License', ['ning', 'tawan'], '2026-11-16', '2026-11-27', '2026-11-30', 'Todo', 'Argento'],
  ['CC+ Gamification', ['map', 'rome'], '2026-11-04', '2026-11-11', '2026-12-03', 'Done', 'CC+'],
  ['CC+ 2026', ['map', 'rome'], '2026-11-17', null, null, 'Todo', 'CC+'],
  ['On Board ผู้ซื้อเป็นผู้ขาย', ['beam', 'tae'], '2026-11-04', '2026-11-06', null, 'Done', 'Marketplace'],
  ['Refactor notification service', [], null, null, null, 'Todo', null],
]

export const DEMO = {
  names: { fah: 'ฟ้า', ning: 'หนิง', tawan: 'ตะวัน', rome: 'โรม', map: 'แม๊พ', tae: 'เต้', beam: 'บีม' },
  projects: [
    { id: 'P1', number: 7, title: 'flow-app Release (ตัวอย่าง)', closed: false, updatedAt: '2026-11-12T03:00:00Z', url: null, shortDescription: 'ข้อมูลสมมติเพื่อทดลองหน้าจอ' },
    { id: 'P2', number: 3, title: 'Backlog 2025 (ตัวอย่าง)', closed: true, updatedAt: '2025-12-20T03:00:00Z', url: null, shortDescription: '' },
  ],
  fields: [
    { id: 1, name: 'Title', type: 'title', options: [] },
    { id: 2, name: 'Assignees', type: 'assignees', options: [] },
    { id: 3, name: 'Status', type: 'single_select', options: ['Todo', 'In Progress', 'Done'] },
    { id: 4, name: 'Start date', type: 'date', options: [] },
    { id: 5, name: 'End date', type: 'date', options: [] },
    { id: 6, name: 'Release date', type: 'date', options: [] },
    { id: 7, name: 'Product', type: 'single_select', options: ['SSCC', 'CC+', 'Argento', 'Multi Point', 'Marketplace'] },
  ],
  items: rows.map((r, i) => {
    const fv = { Status: r[5] }
    if (r[2]) fv['Start date'] = r[2]
    if (r[3]) fv['End date'] = r[3]
    if (r[4]) fv['Release date'] = r[4]
    if (r[6]) fv.Product = r[6]
    return {
      id: 'I' + i, archived: false, title: r[0], url: null, ref: 'flow-app#' + (100 + i),
      people: r[1].slice().sort(), cstate: r[5] === 'Done' ? 'CLOSED' : 'OPEN', merged: false, fv,
    }
  }),
}
