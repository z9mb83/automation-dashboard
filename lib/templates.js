/**
 * WhatsApp template preview helpers (pure, unit-tested in test/templates.test.mjs).
 * The sheet feed (action=templates) returns each brand's template as Meta stores it; the dashboard shows it as a
 * WhatsApp-style bubble with the blanks ({{1}}, {{name}}) filled with Meta's sample values, else a sample name.
 */
export const SAMPLE_NAME = 'Rohit';

/** Body text with every {{1}} / {{name}} filled: Meta's example for that blank, else a sample name / "…". */
export function fillTemplate(body, examples = []) {
  const order = [];
  return String(body || '').replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (all, key) => {
    let i = order.indexOf(key);
    if (i < 0) { order.push(key); i = order.length - 1; }
    const ex = examples[/^\d+$/.test(key) ? Number(key) - 1 : i];
    return ex !== undefined && String(ex).trim() !== '' ? String(ex) : i === 0 ? SAMPLE_NAME : '…';
  });
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** WhatsApp formatting -> safe HTML: *bold*, _italic_, ~strike~, ```mono```, line breaks. Text is escaped first. */
export function waHtml(text) {
  return esc(text)
    .replace(/```([\s\S]+?)```/g, '<code>$1</code>')
    .replace(/(^|[\s(])\*(?!\s)([^*\n]+?)\*(?=[\s).,!?:;]|$)/g, '$1<b>$2</b>')
    .replace(/(^|[\s(])_(?!\s)([^_\n]+?)_(?=[\s).,!?:;]|$)/g, '$1<i>$2</i>')
    .replace(/(^|[\s(])~(?!\s)([^~\n]+?)~(?=[\s).,!?:;]|$)/g, '$1<s>$2</s>')
    .replace(/\n/g, '<br>');
}

/** Google Drive share link -> file id (for the logo shown as the template's image header), else ''. */
export function driveId(url) {
  const m = /(?:file\/d\/|open\?id=|[?&]id=)([\w-]{20,})/.exec(String(url || ''));
  return m ? m[1] : '';
}
