# Troubleshooting

The dashboard only reads. Nothing here can stop mail, WhatsApp or SMS from being sent.
Sending problems are documented in the sender repo:
[`unified-communication-automation/TROUBLESHOOTING.md`](https://github.com/z9mb83/unified-communication-automation/blob/main/TROUBLESHOOTING.md)
and, for SMS, the `OCR` repo's `docs/TROUBLESHOOTING.md`.

## Can't open the dashboard
- **Wrong password / asked again and again:** first pick the right card on the sign-in page. Owner = `DASHBOARD_PASSWORD`, Admin = `ADMIN_PASSWORD` (both in Vercel); Viewer needs none. Each password only works on its own card. Changing a password (or `SHEET_API_KEY`) signs everyone out.
- **Admin card says no admin login:** `ADMIN_PASSWORD` is not set in Vercel. Add it (the owner types it), then Redeploy.
- **"Dashboard password is not configured":** add `DASHBOARD_PASSWORD` in Vercel → Settings → Environment Variables, then Redeploy.

## Template preview
- **"Could not load" / empty window:** the sheet web app must be version 18 or later (action `templates`). Meta changes show after up to 10 minutes.
- **Text running over the note:** fixed 26 Nov (PR #9); press Ctrl+F5 once to load the new version.

## Page shows "sample data"
- `SHEET_API_URL` or `SHEET_API_KEY` is missing on Vercel. Add both (see README → Settings) and Redeploy.

## "feed: unauthorized"
- The key on Vercel is not the sheet's key. Sheet → **AUTOMATION → Dashboard → Create access key** → paste exactly the 64 characters → Redeploy.

## "feed did not return JSON"
- The Apps Script web app is not deployed with access **Anyone**, or the URL is not the one ending in `/exec`.
  Sheet → **AUTOMATION → Dashboard → Show feed link**.

## Numbers look old after a script change
- Apps Script web apps serve a fixed version: Apps Script → **Deploy → Manage deployments → edit → New version**.
- The feed caches 30 seconds and the page refreshes every minute.

## Lead numbers changed after the working tabs (SB Mail / SB WhatsApp ...)
- The dashboard still reads the brand tabs (SB, 99M, 99S, PE, SC), which are now hidden. Hidden tabs are read the same way,
  so the numbers stay right. Do not rename or delete the hidden tabs.
- A big paste into a working tab is added to the brand tab by the bulk run (`leBulkSync`); counts catch up after it runs.

## SMS page
- **"Telinfy refused the API key (HTTP 401/403)":** set `TELINFY_API_KEY` again (Telinfy login: username `99consulting`),
  turn IP whitelisting off in Telinfy, Redeploy.
- **Empty or partial:** Telinfy keeps reports for a limited period; choose a shorter date range.
- **A template shows 0 sent but SMS went out:** the template is missing in Telinfy or its text differs.
  Shaadi sheet → **SMS → Check templates with Telinfy**.

## WhatsApp page / Inbox
- **Delivered numbers missing:** delivery reports come from Meta's webhook into the sheet. If the webhook stopped, *Sent*
  rows never turn *Delivered*; check the sender repo's troubleshooting (webhook section).
- **Inbox empty:** the feed's `?inbox=all` reads the sheet's inbox tabs; run **Set up / repair tabs** in the sheet.

## Mail reply tracker
- Filled by the email sender every 15 minutes into the hidden `Mail Threads` tab.
- A mailbox marked **Needs reconnect** (for example after `invalid_grant`) has no replies tracked until it is reconnected
  in Cloud Shell (`cd ~/mail` first, not `cd ~mail`).

## Costs
- Estimates from the sheet's records: WhatsApp marketing templates are charged when delivered (failed and replies are free),
  SMS Rs 0.22 per SMS submitted (DND too), email free. Check rates against invoices and update `RATES` in `lib/costs.js`.

## Deploys
- **Setting changed but no effect:** settings apply only to new deployments: Deployments → latest → … → Redeploy.
- **Deployment `Canceled`:** Redeploy and let it finish (about a minute).
- Every push to `main` deploys automatically. Run `npm test` before merging.
