# start.md: launch a new website + CRM from this repo

Read this first when you start a new client site. It covers only what matters in the **initial phase**: what to collect, what to change, how to host it, how to prove the forms reach the CRM. Day-to-day editing is in [agent.md](agent.md); CRM details are in [README.md](README.md); the form message format is in [docs/intake-spec.md](docs/intake-spec.md).

Do the steps in order. Each one ends with a check; do not move on until it passes.

---

## 0. What you are building

```
Visitor ─► website (static Astro, Hostinger, example.com)
              │  every form is 2 steps: your details ─► pick a call time
              ▼
          CRM API (Express + MongoDB Atlas, Hostinger Node app, crm.example.com)
              │   POST /api/intake   lead · appointment · skip   (tf-intake/1)
              │   GET  /api/slots    free call times
              ▼
          CRM dashboard (same app, served at "/": leads, pipelines, appointments, team…)
```

- One repo, three folders: `website/`, `backend/`, `frontend/` (the dashboard; it builds into `backend/public`).
- **One CRM per business**: its own MongoDB database, its own Hostinger Node app, its own subdomain. There is no multi-client mode.
- If the CRM is down or slow, every form falls back to a prefilled WhatsApp message, so no lead is lost.

## 1. Collect before you start

| Need | Notes |
|---|---|
| **Accounts** | GitHub; a Hostinger plan that includes **Node.js web apps** (static-only hosting cannot run the CRM); MongoDB Atlas (free M0 is fine); the domain (DNS access) |
| **Site build folder** | the `live/` folder from your site generator: `index.html` + `<route>/index.html` for every page, `404.html`, `<route>/index.md`, `llms.txt`, `llms-full.txt`, `robots.txt`, `media/og-default.jpg` (1200×630) |
| **Brand** | square logo/favicon source (192px or larger, transparent PNG) |
| **Contact** | phone, WhatsApp number (digits with country code, e.g. `917507994138`), email |
| **Booking rules** | days, hours, slot length, how early a visitor may book (default Mon to Sat, 11:00 to 18:00 India time, 30 min, 3 h ahead) |
| **Pipelines** | up to 4 business areas ("pillars") with the stages a lead moves through |
| **Forms** | list every form: page, fields, which pillar, what call it books ("Free Business Audit call", "counselling call"…) |
| **Team** | names and roles (owners of leads, tasks, attendance) |

> **India assumptions are built in:** times are IST (`+05:30`), phone numbers normalise to `+91`, money shows as ₹. A client in another country or time zone needs code changes in `backend/lib/time.js` (the offset), `backend/lib/intakeMap.js` (phone numbers) and `website/src/chrome/app.js` (search for `330` and `+05:30`). Do not skip this.

## 2. Create the project

1. Make a **new GitHub repo from this one** (GitHub → this repo → *Use this template*, or copy the folder without `.git` and `git init`). Never reuse the old repo or its MongoDB database.
2. Delete what does not carry over: `website/legacy/`, `.github/workflows/deploy.yml` (the FTP deploy; Hostinger's GitHub integration replaces it), `render.yaml` if you will not use Render, `tools/mock-intake.js` is worth keeping.
3. Rename in `package.json` (root, `backend/`, `frontend/`, `website/`) if you like. Never commit `.env`.

## 3. Put the site in (website/)

```bash
python3 tools/port-site.py path/to/live --check    # verifies, writes nothing
python3 tools/port-site.py path/to/live            # writes website/src and website/public
```

The script stores the shared parts (CSS, header, footer, site script, icon sprite) **once**, gives each page a thin wrapper with its own title, description, canonical, dates and structured data, and copies the Markdown copies, `llms.txt`, `robots.txt` and `media/`. It **stops** and names the page if the shared parts differ between pages. It replaces `website/src/html`, `website/src/pages` and the shared files, so run it on a clean copy.

Then change the per-site constants (this is the whole list for the website):

| File | Change |
|---|---|
| `website/astro.config.mjs` | `site: 'https://example.com'` |
| `website/src/layouts/Layout.astro` | `SITE`, `OG_ALT`, `og:site_name`, `author`, the **default CRM URL** (a wrong one sends leads to the wrong CRM), `wa`, `phone`, `email`, fallback `hours` |
| `website/keywords.json` | one keyword line per page (`slug`: route with `/` as `__`, home = `index`); rerun the port. The script writes missing slugs to `keywords.todo.json` |
| `website/public/` | `favicon.ico`, `favicon-32x32.png`, `icon-192.png`, `apple-touch-icon.png` (same set in `frontend/public/`); check the `Sitemap:` line in `robots.txt` shows the new domain; `.htaccess` comment |

**Check:** `cd website && npm install && npm run build` ends with `N page(s) built`; open `npm run dev` and click through home, a service page, contact, 404.

**SEO, per page** (all come from the build; verify, do not skip): unique `<title>` (aim ≤ 60 characters) and meta description (120 to 160), one H1, canonical, Open Graph image, JSON-LD, sitemap (`sitemap-index.xml`, generated by Astro), `noindex` on the 404. The `keywords` meta is included because it was asked for, but search engines ignore it; rankings come from the title, description, headings and content.

## 4. Set up the CRM (backend/ + frontend/)

1. **Pipelines:** edit `backend/lib/constants.js` (`PILLARS` names and stages, `APPT_KINDS`, `SOURCES`). **Keep the four keys** `services`, `production`, `training`, `incubation` and rename only the display `name`s and `stages`: the dashboard and every form's `data-pillar` use those keys (an unknown pillar is rejected with 422 and the form falls back to WhatsApp). A pillar you do not need can stay empty; deleting one breaks the dashboard.
2. **Branding text in the dashboard:** the name/logo in `frontend/src/App.jsx` and `frontend/index.html`; wording that mentions the old business or Incube8 in `frontend/src/views/Overview.jsx`, `Reports.jsx`, `Website.jsx`, `frontend/src/lib/derive.js` (report text) and `frontend/src/dialogs/index.jsx` (the WhatsApp/email confirmation message). Search the repo for the old brand name.
3. **Form fields:** any field the forms send that the CRM does not know is saved in the lead's `extra`, so nothing is lost. To show a new field nicely, add its key to `INTEREST_KEYS` (`backend/lib/constants.js`) and a label in `frontend/src/dialogs/index.jsx`.
4. `backend/lib/http.js`: replace the default `CORS_ORIGINS` domains (or always set the env var, step 5).
5. **Build the dashboard and commit it** (Hostinger does not build it):
   ```bash
   npm run build        # repo root; writes backend/public
   git add backend/public
   ```
6. **Local test:** `cp backend/.env.example backend/.env`, run MongoDB (`mongod`) or use an Atlas URI, then `cd backend && npm install && npm start`; open http://localhost:5000 and log in (`admin` / `admin123` locally only).

> **Dependencies live in two places.** Hostinger runs `npm install` only in the repo root, so any package the server needs must be in the **root `package.json`** as well as `backend/package.json`, or the app crashes with `Cannot find module`.

## 5. Host it (Hostinger, both apps from the same GitHub repo)

**MongoDB Atlas first:** create a free cluster → Database Access: add a user → Network Access: allow `0.0.0.0/0` (Hostinger's IPs change) → copy the connection string and put this client's own **database name** in it (`…mongodb.net/clientname?retryWrites=true…`). One free cluster can hold a different database per client. The free tier has no scheduled backups: export leads (Leads → Export CSV) regularly, or upgrade.

| | **Website** | **CRM** |
|---|---|---|
| Source | GitHub repo, branch `main` | same repo, branch `main` |
| Framework / type | **Astro** | Express (Node.js app) |
| Root directory | `website` | `/` (repo root) |
| Build command | `npm run build` | none (the dashboard is committed) |
| Output directory | `dist` | none |
| Entry file | leave empty | `server.js` |
| Node version | **22 or 24** (Astro refuses 20) | 20 or newer |
| Domain | `example.com` and `www` | `crm.example.com` |

**CRM environment variables** (hPanel → the app → Environment variables):

| Variable | Value |
|---|---|
| `MONGODB_URI` | the Atlas string with the client's database name |
| `ADMIN_PASSWORD` | the dashboard password |
| `JWT_SECRET` | a long random string: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `NODE_ENV` | `production` (without `ADMIN_PASSWORD` and `JWT_SECRET`, login is refused) |
| `CORS_ORIGINS` | `https://example.com,https://www.example.com` (only these origins may call the forms' endpoints) |
| `PUBLIC_URL` | `https://crm.example.com` |
| `INTAKE_AUTO_CONFIRM` | `false` = website bookings wait as "requested" until you confirm them; `true` = confirmed at once |

**Website environment variables:** `PUBLIC_CRM_INTAKE_URL` = `https://crm.example.com/api/intake` (and `PUBLIC_CRM_SLOTS_URL` only if the slots URL is not the same host).

**Deploying:** always use *deploy latest commit from GitHub*. A plain *Redeploy* reuses the previous source ("Restoring previous source" in the log) and your fix never ships.

## 6. Connect and test the forms

On the live URLs:

1. `https://crm.example.com/api/health` → `{"ok":true,"db":"connected"}`.
2. `https://crm.example.com/api/slots?days=14` → a list of days and times.
3. Log in at `https://crm.example.com`, then **Settings**: booking hours (must match the fallback `hours` in `Layout.astro`), default owner per pillar, team members.
4. On the website, fill **each different form** (the hero form, the audit form, contact, apply, partner, training…) through both steps. For each, the CRM must show: the lead in **Leads** with the right pillar and "Came from" (page, UTM), the booking in **Appointments** as *requested*, and the form's own fields in the lead.
5. Pick the same slot from a second browser: the second visitor must get "That time was just taken".
6. Press **Skip for now**: the lead appears with next action "Call the lead".
7. Stop the CRM (or set a wrong `PUBLIC_CRM_INTAKE_URL`): the form must open WhatsApp with the details.

## 7. Before you announce it

- **Privacy, terms and refund pages must exist** (`/privacy-policy/`, `/terms/`, `/refund-policy/` are linked from every form and the footer). The lead is saved at step 1, before a time is chosen; the privacy text should say so.
- Delete your test leads; change nothing else in production data by hand.
- Submit `https://example.com/sitemap-index.xml` in Google Search Console; add the analytics tag (the script already pushes events to `dataLayer`).
- Confirm HTTPS on both domains and that `www` redirects the way you want.

## 8. Mistakes we already made (do not repeat)

- **Wrong Node version on the website** → build fails with "Node.js v20 is not supported by Astro". Set 22 or 24.
- **CRM crashed with `Cannot find module 'dotenv'`** → server packages were only in `backend/package.json`. Keep them in the root `package.json` too.
- **`/` showed "CRM dashboard is not built"** → the dashboard is not built on Hostinger. Run `npm run build` and commit `backend/public` after every frontend change.
- **Old code kept running after "Redeploy"** → use *deploy latest commit*.
- **Forms posting to the wrong CRM** → the default CRM URL in `Layout.astro` still pointed at the previous client.
- **A red ✗ on every push** → the old FTP workflow (`.github/workflows/deploy.yml`) failing with `530 Login incorrect`. Delete it when Hostinger deploys from GitHub itself.
- **Browser still shows the old favicon** → hard refresh (Ctrl+F5) or a private window.
- **Running a script from the wrong folder** → `tools/port-site.py` always writes into this repo's `website/`; commit first so you can `git diff` or `git checkout` the result.

## 9. Or ask Claude Code to do steps 2 to 4

Open the new repo in Claude Code and paste:

> Read `start.md`, `agent.md` and `README.md`. This repo is a template for a website + CRM. New client: **<name>**, domain **<example.com>**, CRM at **<crm.example.com>**, phone **<…>**, WhatsApp **<…>**, email **<…>**. The site build folder is **<path>**. Pipelines: **<pillar → names and stages>**. Do steps 2 to 4 of `start.md`: run `tools/port-site.py` on the build folder, set every per-site constant, rename the pillars, replace the old brand name everywhere, build `website/` and the dashboard, and test the forms against `tools/mock-intake.js`. Do not push. Then give me the exact Hostinger settings and environment variables to fill in.

## 10. Where things live

| Want to change | Where |
|---|---|
| A page's text | `website/src/html/<slug>.html` |
| A page's title, description, keywords | `website/src/pages/<route>/index.astro` (keywords also in `website/keywords.json`) |
| Nav, footer, floating bar | `website/src/chrome/pre.html`, `post.html` |
| Form behaviour, slots, WhatsApp fallback | `website/src/chrome/app.js` |
| Styles, colours, dark mode | `website/src/styles/global.css` |
| Head tags, CRM URL, contact details | `website/src/layouts/Layout.astro` |
| Which fields a form sends and where they land | `docs/intake-spec.md`, `backend/lib/intakeMap.js` |
| Pipelines, appointment types, sources | `backend/lib/constants.js` |
| Booking hours, team, default owners | CRM dashboard → Settings |
| Dashboard screens | `frontend/src/views/`, `frontend/src/dialogs/` |
