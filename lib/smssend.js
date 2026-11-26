// "Send SMS" page: the two OCR sheets that send SMS through Telinfy.
// Each sheet runs its own Apps Script web app (src/SmsApi.gs in the OCR repo).
export const SMS_SHEETS = [
  { code: 'SB', sheet: 'Shaadi OCR', urlVar: 'SMS_SB_URL', keyVar: 'SMS_SB_KEY' },
  { code: 'PE', sheet: 'Property NeoDove', urlVar: 'SMS_PE_URL', keyVar: 'SMS_PE_KEY' },
];

/** URL + key for one brand from the environment, or null when not set up. */
export function smsTarget(code, env = process.env) {
  const s = SMS_SHEETS.find((x) => x.code === code);
  if (!s) return null;
  const url = String(env[s.urlVar] || '').trim(), key = String(env[s.keyVar] || '').trim();
  return url && key ? { ...s, url, key } : { ...s, url: '', key: '' };
}

/** Builds the web-app URL for an action (the key stays on the server). */
export function smsUrl(t, action) {
  return t.url + (t.url.includes('?') ? '&' : '?') + `action=${action}&key=${encodeURIComponent(t.key)}`;
}

/** Upload on the Send SMS page: the file's numbers -> body for the sheet's bulkadd action (+ what the file held). */
export function smsUploadBody(parsed, fileName) {
  if (!parsed.items.length) return { error: 'No phone number column found in the file.' };
  return {
    body: { file: String(fileName || 'upload'), rows: parsed.items },
    file: { rows: parsed.total, valid: parsed.valid, column: parsed.phoneHeader || 'column ' + (parsed.phoneCol + 1) },
  };
}
