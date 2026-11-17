/**
 * Reading an uploaded phone list (pure, unit-tested in test/upload.test.mjs).
 * CSV/TSV/TXT or XLSX (first sheet). Finds the phone column (header like Phone / Mobile / WhatsApp / Number,
 * otherwise the column with the most 10+ digit values) and an optional name column.
 */
import { inflateRawSync } from 'node:zlib';

export function parseCsv(text) {
  const t = String(text || '').replace(/^﻿/, '');
  const first = t.split(/\r?\n/, 1)[0] || '';
  const sep = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t'
    : (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

// --- minimal .xlsx reader: zip central directory + sheet XML ---
function unzip(buf) {
  const b = Buffer.from(buf), files = {};
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 70000); i--) if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('This is not a valid .xlsx file.');
  let p = b.readUInt32LE(eocd + 16);
  const count = b.readUInt16LE(eocd + 10);
  for (let n = 0; n < count; n++) {
    if (b.readUInt32LE(p) !== 0x02014b50) break;
    const method = b.readUInt16LE(p + 10), csize = b.readUInt32LE(p + 20), nlen = b.readUInt16LE(p + 28),
      xlen = b.readUInt16LE(p + 30), clen = b.readUInt16LE(p + 32), off = b.readUInt32LE(p + 42);
    const name = b.slice(p + 46, p + 46 + nlen).toString('utf8');
    const lnlen = b.readUInt16LE(off + 26), lxlen = b.readUInt16LE(off + 28), start = off + 30 + lnlen + lxlen;
    files[name] = () => { const raw = b.slice(start, start + csize); return (method === 8 ? inflateRawSync(raw) : raw).toString('utf8'); };
    p += 46 + nlen + xlen + clen;
  }
  return files;
}
const unxml = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&');
const colIndex = (ref) => { let n = 0; for (const ch of String(ref).replace(/\d+/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

export function parseXlsx(buf) {
  const files = unzip(buf);
  const shared = [];
  if (files['xl/sharedStrings.xml']) {
    for (const m of files['xl/sharedStrings.xml']().matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      shared.push(unxml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join('')));
    }
  }
  const sheetName = Object.keys(files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort((a, b) =>
    Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1]))[0];
  if (!sheetName) throw new Error('No sheet found in the .xlsx file.');
  const rows = [];
  for (const rm of files[sheetName]().matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cm of rm[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1], inner = cm[2] || '';
      const ref = (attrs.match(/\br="([A-Z]+\d+)"/) || [])[1], type = (attrs.match(/\bt="(\w+)"/) || [])[1];
      let v = '';
      if (type === 'inlineStr') v = unxml([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(''));
      else {
        const raw = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        if (raw != null) v = type === 's' ? shared[Number(raw)] || '' : unxml(raw);
      }
      if (type !== 's' && type !== 'inlineStr' && type !== 'str' && /^-?\d+(\.\d+)?(E\+?\d+)?$/i.test(v)) {
        const num = Number(v); if (Number.isFinite(num) && Math.abs(num) >= 1e6) v = BigInt(Math.round(num)).toString();
      }
      const i = ref ? colIndex(ref) : row.length;
      while (row.length < i) row.push('');
      row[i] = v;
    }
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

const digits = (v) => String(v || '').replace(/\D/g, '');
const looksPhone = (v) => { const d = digits(v); return d.length >= 10 && d.length <= 15; };

/** rows -> { phoneCol, nameCol, header, items: [{phone, name}], total } */
export function pickNumbers(rows) {
  if (!rows.length) return { phoneCol: -1, nameCol: -1, header: false, items: [], total: 0 };
  const width = Math.max(...rows.map((r) => r.length));
  const head = rows[0].map((h) => String(h || '').trim());
  const header = head.some((h) => h && !looksPhone(h)) && !head.some(looksPhone);
  const body = header ? rows.slice(1) : rows;
  // how many real phone numbers (10-15 digits) each column holds
  const counts = Array.from({ length: width }, (_, c) => body.filter((r) => looksPhone(r[c])).length);
  // a heading that names a phone column wins, but only if that column really holds phone numbers
  // ("Contact Person" or "Serial No" match the words but contain names / small numbers)
  const PHONE_HEAD = /phone|mobile|whats ?app|contact|number|cell|\bno\b|\bmob\b/i;
  let phoneCol = -1, bestN = 0;
  head.forEach((h, c) => { if (header && PHONE_HEAD.test(h) && counts[c] > bestN) { bestN = counts[c]; phoneCol = c; } });
  if (phoneCol < 0 || bestN < Math.max(1, Math.max(...counts) / 2)) {
    phoneCol = -1; bestN = 0;
    counts.forEach((n, c) => { if (n > bestN) { bestN = n; phoneCol = c; } });
  }
  const NAME_HEAD = /name|person|company|client/i;
  const nameCol = header ? head.findIndex((h, i) => i !== phoneCol && NAME_HEAD.test(h) && counts[i] < body.length / 2) : -1;
  const items = phoneCol < 0 ? [] : body.map((r) => ({ phone: String(r[phoneCol] ?? '').trim(), name: nameCol >= 0 ? String(r[nameCol] ?? '').trim() : '' }))
    .filter((x) => x.phone !== '');
  return { phoneCol, nameCol, header, phoneHeader: header ? head[phoneCol] || '' : '', items, total: items.length,
    valid: items.filter((x) => looksPhone(x.phone)).length };
}

export function readUpload(name, buf) {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.xlsx')) return pickNumbers(parseXlsx(buf));
  if (lower.endsWith('.xls')) throw new Error('Old .xls files are not supported: save it as .xlsx or .csv first.');
  return pickNumbers(parseCsv(Buffer.from(buf).toString('utf8')));
}
