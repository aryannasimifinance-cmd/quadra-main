// سازنده‌ی فایل اکسل واقعی (xlsx) بدون کتابخانه — چند شیت، راست‌به‌چپ، جداکننده‌ی هزارگان
// هر سلول: رشته، عدد، null یا { v, s } که s یکی از 'h' (سرستون)، 'b' (جمع/پررنگ)، 't' (عنوان) است

const enc = new TextEncoder()
let TABLE
function crc32(buf) {
  if (!TABLE) {
    TABLE = new Uint32Array(256)
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; TABLE[n] = c >>> 0 }
  }
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

// زیپ بدون فشرده‌سازی (STORE) — برای اکسل کافی است
function zip(files) {
  const parts = [], central = []
  let offset = 0
  const d = new Date()
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  files.forEach((f) => {
    const name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data), size = data.length
    const h = new DataView(new ArrayBuffer(30))
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true)
    h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true); h.setUint32(18, size, true)
    h.setUint32(22, size, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true)
    parts.push(new Uint8Array(h.buffer), name, data)
    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true)
    c.setUint16(10, 0, true); c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true)
    c.setUint32(20, size, true); c.setUint32(24, size, true); c.setUint16(28, name.length, true)
    c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true)
    c.setUint32(38, 0, true); c.setUint32(42, offset, true)
    central.push(new Uint8Array(c.buffer), name)
    offset += 30 + name.length + size
  })
  const cdSize = central.reduce((s, x) => s + x.length, 0)
  const e = new DataView(new ArrayBuffer(22))
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true)
  e.setUint32(12, cdSize, true); e.setUint32(16, offset, true)
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
const colName = (i) => { let s = ''; i += 1; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26) } return s }

function cell(ref, c) {
  if (c == null || c === '') return ''
  const o = typeof c === 'object' ? c : { v: c }
  if (typeof o.v === 'number' && Number.isFinite(o.v)) return `<c r="${ref}" s="${o.s === 'b' ? 3 : 2}"><v>${Math.round(o.v * 100) / 100}</v></c>`
  const s = { h: 1, t: 4, b: 5 }[o.s] || 0
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(o.v)}</t></is></c>`
}

function sheetXml(rows) {
  const widths = []
  rows.forEach((r) => r.forEach((c, i) => {
    const v = c && typeof c === 'object' ? c.v : c
    if (c && typeof c === 'object' && c.s === 't') return
    const len = typeof v === 'number' ? Math.round(v).toLocaleString('en').length + 2 : String(v ?? '').length
    widths[i] = Math.max(widths[i] || 8, Math.min(48, len + 3))
  }))
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w || 10}" customWidth="1"/>`).join('')
  const data = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((c, ci) => cell(colName(ci) + (ri + 1), c)).join('')}</row>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${data}</sheetData></worksheet>`
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Tahoma"/></font><font><b/><sz val="11"/><name val="Tahoma"/></font><font><b/><sz val="14"/><name val="Tahoma"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD6F7F5"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FF9A988F"/></top><bottom style="thin"><color rgb="FF9A988F"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

const sheetName = (n, i, used) => {
  let s = String(n || `Sheet${i + 1}`).replace(/[[\]:*?/\\]/g, ' ').slice(0, 31)
  while (used.has(s)) s = s.slice(0, 28) + ' ' + (i + 1)
  used.add(s)
  return s
}

// sheets: [{ name, rows }]
export function xlsxBlob(sheets) {
  const used = new Set()
  const names = sheets.map((s, i) => sheetName(s.name, i, used))
  const files = [
    { name: '[Content_Types].xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', text: STYLES },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, text: sheetXml(s.rows) })),
  ]
  return zip(files)
}

export function downloadXlsx(name, sheets) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(xlsxBlob(sheets))
  a.download = name.endsWith('.xlsx') ? name : name + '.xlsx'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1500)
}

// جدول ساده: عنوان + سرستون + ردیف‌ها (+ ردیف جمع)
export const table = (title, head, rows, total) => [
  ...(title ? [[{ v: title, s: 't' }], []] : []),
  head.map((h) => ({ v: h, s: 'h' })),
  ...rows,
  ...(total ? [total.map((c) => (c == null ? null : { v: c, s: 'b' }))] : []),
]
