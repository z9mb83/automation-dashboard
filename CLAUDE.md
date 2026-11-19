# CLAUDE.md - automation-dashboard

Read this first, then `README.md` and `TROUBLESHOOTING.md`.

## What this is
The web dashboard for the outreach automation (repo `unified-communication-automation`). Next.js 15 on **Vercel Hobby (free)**.
It has no database: every API route calls the **Automation Control Center Apps Script web app** (`SHEET_API_URL` + `?key=SHEET_API_KEY`),
and SMS reports come straight from Telinfy.

Pages (hash routing in `app/page.js`): Home (Today strip + action cards) · `#send` / `#send/<BRAND>` Send WhatsApp ·
`#email` / `#email/<BRAND>` Send Email · `#reports` Reports & costs · analytics `#mail`, `#whatsapp`, `#sms` (reached from the
brand pages, not the top menu) · `/inbox` WhatsApp-style inbox · `/login`.

## Environment variables (Vercel → Settings → Environment Variables; values live only there)
| Name | What |
|---|---|
| `SHEET_API_URL` | Apps Script web app `/exec` URL (sheet menu AUTOMATION → Dashboard → Show feed link) |
| `SHEET_API_KEY` | access key made in the same menu |
| `DASHBOARD_PASSWORD` | login password for the dashboard |
| `TELINFY_API_KEY` | Telinfy (user 99consulting) API key, only for the SMS page |
| `SMS_SB_URL`, `SMS_SB_KEY`, `SMS_PE_URL`, `SMS_PE_KEY` | Send SMS page: web app `/exec` link + access key (menu SMS → Dashboard access key) of the Shaadi OCR and Property sheets (OCR repo, `src/SmsApi.gs`) |

Without the sheet variables the page shows clearly-labelled sample data.

## Where it runs
- **Live: `https://automation-dashboard-pi-ten.vercel.app`** - Vercel team ACE (Hobby), project `automation-dashboard`, built from `z9mb83/automation-dashboard`
  (set up 19 Nov 2026 with the same four variables; every push to `main` redeploys).
- Old: `https://automation-dashboard-sigma-rose.vercel.app` (old Vercel account, old `linkwithmarketing-design` repo) - retired.
- The sheet links to the dashboard at the top of its **Dashboard** tab and in **Settings** ("Web dashboard").

## Code map
- `app/api/*/route.js` - server routes. `whatsapp/route.js` handles uploads (multipart, `kind` = whatsapp → `bulkadd`,
  mail → `mailbulkadd`) and JSON actions `brands, mailbrands, queue, sendnext, rowstatus, mailqueue, mailsendnext, mailrowstatus`. `maxDuration = 60`.
- `app/api/logo/route.js` - proxies Google Drive thumbnails for the brand logos (id regex `^[\w-]{20,80}$`).
- `app/api/report/route.js` + `components/report.js` - "Download report" (60 s, one retry; the sheet serves it from a cache).
- `lib/upload.js` - CSV/XLSX reading with no dependencies (`lib/xlsx.js`: zip central directory + `zlib.inflateRawSync`);
  `pickNumbers` / `pickEmails` find the right column by heading and by content.
- `components/wa-send.js` (brand cards, brand page), `components/wa-bulk.js` (upload, Send next 30/25, last-upload results kept in localStorage).
- `app/globals.css` - blue + pastel pink theme (tokens `--blue`, `--pink`).
- `middleware.js` + `lib/auth.js` - password login cookie.

## Decisions (from the chats)
- Nov 2026: the owner found the sheet too complicated, so staff work from the dashboard: pick a brand, upload a CSV/XLSX,
  **Send next 30** WhatsApp (daily cap 2,000 per brand) / **Send next 25** emails. Upload files usually have many columns -
  detection must pick the real phone/email column (not Serial No / Contact Person).
- Analytics is not on the top menu (too much information all the time); it is one click from each brand page.
- Theme: blue + pastel pink (the old one was "too boring").
- 19 Nov 2026: **Send SMS** page (`#send-sms`, `components/sms-send.js`, `app/api/sms-send/route.js`, `lib/smssend.js`): Send next 100 for SB and PE,
  which runs the OCR sheet's own `sendNextBatch_` (same skip rules); refused in Dry run and outside 9 AM - 9 PM.
- Never send to customers from tests or previews.

## Tests
`npm test` (Node test runner, `test/*.test.mjs`, 39 tests incl. a real XLSX fixture). Run them before every PR.

## Owner and how to work with him

- Owner: the 99 group of brands (99 Consulting / 99 Marketing Services). Brand codes used everywhere:
  **SB** Shaadi Bells · **99M** 99 Marketing Services · **99S** 99 Staffing Services · **PE** Property Experts Group · **SC** Skyline Capital (business buying/selling).
- The sheets, Apps Script projects and Gmail senders belong to the owner's main Google account (the 99 Marketing "linkwithmarketing" account).
- GitHub: this repo was copied with its full history from `linkwithmarketing-design/<repo>` to `z9mb83/<repo>` on 19 Nov 2026
  (a fresh copy, not a GitHub transfer). The old copy still exists; new work goes to **z9mb83**.
- The owner is not a programmer. Explain in plain words and give the result, not a list of steps you took.
- He wants a simple internal tool, not a product: only what he asks for, as little code and as few files as possible, no Docker or
  other maintenance-heavy setups. Keep old code (move it to `archive/`) instead of deleting it.
- **He does not pay for anything.** Free tiers only (Apps Script, Vercel Hobby, free Cloud Run/Cloud Shell use). No paid GitHub Actions/Codespaces.
- Update `README.md` (and `TROUBLESHOOTING.md` where there is one) with every change, in plain language.

### Hard rules (from the owner, always in force)
- Never commit or print secrets. Keys live in Apps Script **Script Properties**, **Vercel environment variables** or **Secret Manager** - never in code, git or normal sheet cells.
- Never put raw Meta access tokens, Google OAuth refresh tokens or SMS API secrets in spreadsheet cells.
- The owner types API keys, passwords and OAuth / device codes himself. Claude never does.
- No live emails, WhatsApp or SMS to real customers, no production campaign switched on, and no redeploy of the running email service or its scheduler without a separate, explicit go-live instruction.
- Never overwrite existing leads, statuses, approval values or formulas in the sheets. Never delete sheet tabs the automation reads.
- Never force-push or overwrite unrelated work. Work on a branch and open a pull request; **merge only when the owner says "merge"**.
- Do not rotate or destroy production credentials without his authorization.

### How changes usually reach production
Most logic runs in **Google Apps Script**, which is not connected to git. The usual loop (done through Claude in Chrome, signed in to the owner's main Google account):
1. Make the change in the repo file and test it offline (each repo has a `test/` or `tests/` folder).
2. Apply the same change in the Apps Script editor (exact text replacement in the editor, then the **Save project to Drive** button; reload to check it saved).
3. If the script is a web app: **Deploy → Manage deployments → Edit (pencil) → Version: New version → description → Deploy**. Editing the existing deployment keeps the `/exec` URL the same.
4. Commit, push the branch, open a PR, wait for "merge". The repo must always match what is live.
