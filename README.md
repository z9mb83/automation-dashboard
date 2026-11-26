# Automation Dashboard

Live, password-protected dashboard for the **Automation Control Center** sheet
(mail + WhatsApp for Shaadi Bells, 99 Marketing, 99 Staffing, Property Experts, Skyline Capital).

**Live: https://automation-dashboard-pi-ten.vercel.app** (Vercel project `automation-dashboard`, team ACE, Hobby plan, built from `z9mb83/automation-dashboard`).
The old address https://automation-dashboard-sigma-rose.vercel.app (old Vercel account) is retired.

It only **reads** data. The sending tools live in the other repo,
[`unified-communication-automation`](https://github.com/z9mb83/unified-communication-automation);
a problem here can never stop mail or WhatsApp.

```
master sheet ──(read-only)──> common/Dashboard.gs web app (JSON, needs access key)
                                   │   in unified-communication-automation
                                   ▼
            this repo on Vercel: /api/data (server, holds the key) ──> browser (charts)
```

## Pages (since 17 Nov 2026)
**Home** (today's numbers, what needs attention, big buttons) · **Send WhatsApp** (one card per brand with its logo; a brand's
page has upload, Send next 30, View analytics, and the last upload with each number's result and WhatsApp status) ·
**Send Email** (same as WhatsApp for email lists: upload, Send next 25 queues AI-written emails through the mail sender) ·
**Send SMS** (since 19 Nov 2026: Shaadi Bells and Property Experts, the two newspaper-ad OCR sheets; **Send next 100** runs the sheet's own
Send Next 100 through its web app `SmsApi.gs` (OCR repo): already-texted, DND and not-in-use numbers are skipped, only 9 AM - 9 PM, never in Dry run) ·
**Analytics** (no menu tab: Home card or a brand's View analytics; Mail / WhatsApp / SMS charts and tables) · **Reports & costs**
(Excel download, sending costs) · **Inbox** (top right). Old links still work: `#mail`, `#whatsapp`, `#sms` open Analytics,
`#costs` opens Reports & costs, `#send/99S` opens a brand's send page. Logos: WhatsApp Setup tab > Header media URL
(Drive files shared "Anyone with the link"), served through `/api/logo`.
Since 26 Nov 2026 each SMS card also has **Add numbers from a file** (.csv / .xlsx, phone column found automatically): new numbers go to the
bottom of that OCR sheet (column A says `Upload: <file> (<date>)`), numbers already in it are skipped, nothing is sent until Send next 100
or the automatic SMS batches (OCR repo, `src/SmsApi.gs` action `bulkadd`). Email and WhatsApp uploads are on each brand's page.

## What it shows
Emails sent today (and failures) · sent / replies / reply rate / WhatsApp for 7, 14 or 30 days ·
emails and replies per day by brand · sent by brand · lead pipeline (no draft → review → approved → sent → replied) ·
every Gmail mailbox against its daily limit (flags "Needs reconnect", "Paused", "Limit reached") ·
latest replies, emails and WhatsApp messages. Filter by date range and brand. Every chart has a table view.
The page refreshes every minute; the sheet feed caches for 30 seconds.

Pages and buttons:
| Where | What |
|---|---|
| Home | Mail, WhatsApp and SMS cards in one row, sending costs section (`/#costs`) |
| Header **Costs** button | This month's spend; hover for the breakdown (WhatsApp delivered marketing templates x Meta rate + 18% GST, SMS x Rs 0.22, email free). Rates: `lib/costs.js` (`RATES`) |
| Mail | Charts above plus the **email reply tracker**: Needs reply / Answered / Marked handled / Auto-replies, waiting time, Gmail link to the thread, *Mark handled*. Data from the hidden `Mail Threads` tab (filled by the email sender every 15 minutes) |
| WhatsApp | Sent / replies per day, what happened to the messages, Not delivered (with Meta's reason), read but no reply (follow-up calls) |
| **Logins** (26 Nov 2026) | **Owner** (`DASHBOARD_PASSWORD`): read-only results: replies (inbox shows only people who replied, no replying; email replies), sent numbers and charts, *Templates in use* (WhatsApp + SMS) and costs (cost button + Costs page). No uploads, no sending, no downloads. **Admin** (`ADMIN_PASSWORD`): runs everything (Send WhatsApp / Email / SMS, uploads, Send next, inbox with every chat incl. sent-only and replies, report downloads, the *What is switched on* panel) but never sees money (no cost button / page, no SMS cost or wallet, SMS report without the cost column). **Viewer** (no password): analytics only, names / numbers / emails / message text masked on the server. Sign-in page: pick Owner / Admin / Viewer (each password only works on its own card); the sign-in ends when the browser closes, *Switch login* (top) goes back to the choice. Rules: `lib/roles.js` (tests `test/roles.test.mjs`), checked in `middleware.js` and each API route |
| **WhatsApp template preview** (26 Nov 2026) | Owner and admin: click a WhatsApp template name (Home *Templates in use* / *What is switched on*, Send WhatsApp brand page) to see it as a WhatsApp bubble: logo header, text with Meta's sample values (else a sample name), footer, buttons. Read from Meta through the sheet web app (action `templates`, ACC v18, cached 10 min). Code: `components/template-preview.js`, `lib/templates.js` |
| **Inbox** (top right) | WhatsApp conversations, from the sheet feed (`?inbox=all`). Since 26 Nov 2026 a **brand tab** row (All · SB · 99M · 99S · PE · SC) with chats and "to reply" counts per brand; the choice is remembered in the browser and `/inbox?brand=SB` opens one brand directly (bookmark per team) |
| SMS | Telinfy reports per template, delivered / failed / DND, stop list, **Excel report** download. Needs `TELINFY_API_KEY` |

## Settings (Vercel → Project → Settings → Environment Variables)
| Name | Where it comes from |
|---|---|
| `SHEET_API_URL` | Sheet menu **AUTOMATION → Dashboard → Show feed link** (ends in `/exec`) |
| `SHEET_API_KEY` | Sheet menu **AUTOMATION → Dashboard → Create access key** (shown once) |
| `DASHBOARD_PASSWORD` | **Owner** password (read-only: replies, sent numbers, templates, costs) |
| `ADMIN_PASSWORD` | **Admin** password (runs sending, uploads, inbox, reports; never sees costs). Must differ from the owner password. Not set = no admin login |
| `TELINFY_API_KEY` | Telinfy (username `99consulting`) → Developer / API key. Only for the SMS page; stays on the server |
| `SMS_SB_URL` / `SMS_PE_URL` | Send SMS page: the `/exec` link of the Shaadi OCR / Property sheet's web app (Apps Script → Deploy → Manage deployments) |
| `SMS_SB_KEY` / `SMS_PE_KEY` | Send SMS page: in that sheet, menu **SMS → Dashboard access key** (shown once) |

Without `SHEET_API_URL`/`SHEET_API_KEY` the page shows clearly-labelled **sample data**.
Changing the password or key signs everyone out.

## Deploying (Vercel)
Already set up (29 Sep 2026). For reference / to rebuild from scratch:
1. Sheet: menu **AUTOMATION -> Dashboard -> Create access key** (copy all 64 characters) and **Show feed link**.
2. vercel.com/new -> Import `automation-dashboard` (GitHub access limited to this repo if you like). Preset: Next.js.
3. **Before the first deploy**, add all three Environment Variables: `SHEET_API_URL`, `SHEET_API_KEY`, `DASHBOARD_PASSWORD`.
   If the project already exists, add/edit them only in **Settings -> Environment Variables** - values typed into
   the import form afterwards are not saved.
4. Deploy. Every push to `main` deploys again automatically.
5. After changing a setting: **Deployments -> latest -> ... -> Redeploy** (settings apply only to new deployments).

## Repair guide
| Problem on the page | Fix | File |
|---|---|---|
| "feed: unauthorized ... (N characters; a sheet key has 64)" | Key in Vercel ≠ key in sheet (on 29 Sep a 114-character value had been pasted): create a new key, paste exactly the 64 characters into `SHEET_API_KEY`, Redeploy | sheet menu / `SHEET_API_KEY` |
| Setting changed but no effect | Redeploy (see Deploying, step 5) | Vercel |
| Send SMS card: "Not connected yet" / "refused the key" / "did not answer" | Add or fix `SMS_SB_*` / `SMS_PE_*` (link must end in `/exec`, web app access "Anyone"; key from the sheet's **SMS → Dashboard access key**), Redeploy | Vercel settings, OCR repo `src/SmsApi.gs` |
| Send SMS button greyed out | Card says why: Dry run mode (sheet **SMS → Mode**), outside 9 AM - 9 PM, or nothing left to text | OCR sheet |
| Deployment shows `Canceled` | It was stopped before finishing - Redeploy and let it run (~1 minute) | Vercel |
| "feed did not return JSON" | Web app not deployed with access **Anyone**, or wrong URL | `common/Dashboard.gs` deployment |
| "snapshot failed: …" | A tab was renamed/removed; run **Set up / repair tabs** | `common/Dashboard.gs` (`dbSnapshot_`) |
| Page says "Dashboard password is not configured" | Set `DASHBOARD_PASSWORD` in **Settings -> Environment Variables** and redeploy | `middleware.js` |
| Feed code changed in the sheet but data looks old | The Apps Script web app serves a fixed version: **Deploy -> Manage deployments -> edit -> New version** | `common/Dashboard.gs` deployment |
| Wrong number on a tile/chart | Counting rules | `common/Dashboard.gs` (`dbLeadStats_`), `app/page.js` |
| SMS page: "Telinfy refused the API key (HTTP 401/403)" | Paste the key again into `TELINFY_API_KEY`, turn IP whitelisting off in Telinfy, Redeploy | `lib/telinfy.js` |
| Costs look wrong | Rates changed (Meta changes them quarterly): edit `RATES` in `lib/costs.js` | `lib/costs.js` |
| Mail reply tracker empty | The email sender fills `Mail Threads` every 15 minutes; a mailbox showing *Needs reconnect* has no replies tracked | `lib/mailreplies.js`, sender repo |
| Chart looks wrong | Chart drawing | `components/charts.js`, colours in `app/globals.css` |

More problems and fixes: [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Run locally
```
npm install
cp .env.example .env.local   # fill in, or leave empty for sample data (password still required)
npm run dev
npm test
```

Note: Vercel's free Hobby plan is meant for non-commercial use; a business dashboard may need Pro.
The same app also runs on Cloudflare Pages or Netlify.
