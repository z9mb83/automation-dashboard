# Automation Dashboard

Live, password-protected dashboard for the **Automation Control Center** sheet
(mail + WhatsApp for Shaadi Bells, 99 Marketing, 99 Staffing, Property Experts, Skyline Capital).

It only **reads** data. The sending tools live in the other repo,
[`unified-communication-automation`](https://github.com/linkwithmarketing-design/unified-communication-automation);
a problem here can never stop mail or WhatsApp.

```
master sheet ──(read-only)──> common/Dashboard.gs web app (JSON, needs access key)
                                   │   in unified-communication-automation
                                   ▼
            this repo on Vercel: /api/data (server, holds the key) ──> browser (charts)
```

## What it shows
Emails sent today (and failures) · sent / replies / reply rate / WhatsApp for 7, 14 or 30 days ·
emails and replies per day by brand · sent by brand · lead pipeline (no draft → review → approved → sent → replied) ·
every Gmail mailbox against its daily limit (flags "Needs reconnect", "Paused", "Limit reached") ·
latest replies, emails and WhatsApp messages. Filter by date range and brand. Every chart has a table view.
The page refreshes every minute; the sheet feed caches for 30 seconds.

## Settings (Vercel → Project → Settings → Environment Variables)
| Name | Where it comes from |
|---|---|
| `SHEET_API_URL` | Sheet menu **AUTOMATION → Dashboard → Show feed link** (ends in `/exec`) |
| `SHEET_API_KEY` | Sheet menu **AUTOMATION → Dashboard → Create access key** (shown once) |
| `DASHBOARD_PASSWORD` | Any password you choose; people type it to open the dashboard |

Without `SHEET_API_URL`/`SHEET_API_KEY` the page shows clearly-labelled **sample data**.
Changing the password or key signs everyone out.

## Repair guide
| Problem on the page | Fix | File |
|---|---|---|
| "Could not refresh: feed: unauthorized" | Key in Vercel ≠ key in sheet: create a new key, paste it into Vercel, redeploy | sheet menu / `SHEET_API_KEY` |
| "feed did not return JSON" | Web app not deployed with access **Anyone**, or wrong URL | `common/Dashboard.gs` deployment |
| "snapshot failed: …" | A tab was renamed/removed; run **Set up / repair tabs** | `common/Dashboard.gs` (`dbSnapshot_`) |
| Page says "Dashboard password is not configured" | Set `DASHBOARD_PASSWORD` in Vercel and redeploy | `middleware.js` |
| Wrong number on a tile/chart | Counting rules | `common/Dashboard.gs` (`dbLeadStats_`), `app/page.js` |
| Chart looks wrong | Chart drawing | `components/charts.js`, colours in `app/globals.css` |

## Run locally
```
npm install
cp .env.example .env.local   # fill in, or leave empty for sample data (password still required)
npm run dev
npm test
```

Note: Vercel's free Hobby plan is meant for non-commercial use; a business dashboard may need Pro.
The same app also runs on Cloudflare Pages or Netlify.
