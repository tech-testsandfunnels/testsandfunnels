# tests&funnels

Two apps in one repo:

- **Marketing site** — Astro static site (the public website). Deploys to Hostinger.
- **CRM** — a MERN app (leads, pipelines, appointments, clients, team, reports), used internally. Website forms feed it through `POST /api/intake`.

```
website/     Astro marketing site (src/, public/, astro.config.mjs; legacy/ = old site, reference only)
backend/     Express + MongoDB API for the CRM; serves the built dashboard at /
frontend/    React (Vite) dashboard for the CRM (builds into backend/public)
docs/        intake-spec.md: what the website forms send the CRM (tf-intake/1)
tools/       mock-intake.js: reference intake server for testing the forms
```

Design + internals: [brandkit.md](brandkit.md) (look & feel), [agent.md](agent.md) (marketing-site internals), [docs/intake-spec.md](docs/intake-spec.md) (website to CRM).

## Run the marketing site

```bash
cd website
npm install
npm run dev      # http://localhost:4321
npm run build    # -> website/dist/  (what gets deployed)
```

**Deploy →** push to `main`. The GitHub Action (`.github/workflows/deploy.yml`) builds `website/` and FTP-uploads `dist/` to Hostinger. Add `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` as repo secrets first, and the `PUBLIC_CRM_INTAKE_URL` variable to send form leads to the CRM (see the end of this file).

## Run the CRM

Needs **MongoDB** (local `mongod`, or an Atlas URI in `MONGODB_URI`). Copy `backend/.env.example` to `backend/.env` first.

```bash
cd backend && npm install && npm run build && npm start     # CRM + API on http://localhost:5000
```

For frontend work, run the API with `npm run dev` in `backend/` and the dashboard with `npm run dev` in `frontend/` (http://localhost:5173, proxies `/api`). Dev login without a `.env`: `admin` / `admin123`. In production (`NODE_ENV=production`) there are no defaults: set `ADMIN_PASSWORD` and `JWT_SECRET` or login is refused.

### What the CRM does

| View | |
|---|---|
| **Overview** | KPIs, leads by pillar, today's appointments, new leads per week, needs attention, sources, Incube8 funnel, team today, tasks, weekly report, client health |
| **Leads** | Every lead (all four pillars). Filter, search, change stage inline, export CSV. A lead shows contact, "Came from" (page, UTM, landing page, referrer), form answers, owner, value, notes, next action and its appointments |
| **Appointments** | Website bookings arrive as *requested*; confirm them (adds a Meet link and opens a ready WhatsApp / email to the visitor), mark done or no-show, rebook, edit, cancel |
| **Pipelines** | A board per pillar: Services, Production house, Training, Incube8 |
| **Clients** | Active clients, monthly fee, health with reason, manager, open tasks |
| **Team** | Attendance (today + last 7 days), task board, output per member |
| **Reports** | This week's numbers and a text report to copy into WhatsApp or email |
| **Website forms** | The intake and slots URLs to put on the site, free slots right now, latest website leads, field mapping |
| **Settings** | Booking hours, default owner per pillar for new website leads, team members |

Pipelines and their stages live in `backend/lib/constants.js` (served to the dashboard by `/api/meta`).

### API

| | Auth | |
|---|---|---|
| `POST /api/intake` | public | Website forms, `tf-intake/1` events `lead`, `appointment`, `skip` ([spec](docs/intake-spec.md)). Idempotent on `submission_id`, 409 `slot_taken` when a slot is held, rate-limited per IP, CORS limited to `CORS_ORIGINS` |
| `GET /api/slots` | public | Free slots in India time: `{ days: [{ date, times[] }] }` |
| `POST /api/auth/login`, `GET /api/auth/verify` | | Admin login (JWT) |
| `/api/leads`, `/api/appointments`, `/api/team`, `/api/tasks`, `/api/clients`, `/api/attendance`, `/api/settings`, `/api/meta` | admin JWT | Dashboard |
| `GET /api/health` | public | `{ ok, db }` |

Test the website side without the CRM: `node tools/mock-intake.js` (reference server from the spec, no database).

### Build & deploy (single URL)

The API serves the built CRM from `backend/public`, so **one service** hosts
everything (API at `/api/*`, the CRM at `/`). It needs a Node host **and** MongoDB; it cannot run on Hostinger *static* hosting.

- **Render + MongoDB Atlas (free):**
  1. **Atlas**: create a cluster and a database user, set Network Access to `0.0.0.0/0`, copy the connection string.
  2. **Render**: New → **Blueprint** → this repo. It reads `render.yaml`. Set `MONGODB_URI` and `ADMIN_PASSWORD` when asked.
  3. Open the Render URL and log in with `admin` / your `ADMIN_PASSWORD`.
- **Any other Node host** (Hostinger Node.js apps, Railway, a VPS): from the repo root, build `npm run build`, start `npm start` (root `package.json`). Or with root directory `backend`: build `npm install && npm run build`, start `npm start`. Set the environment variables from `backend/.env.example`.

If `/` says "CRM dashboard is not built", the build command skipped `npm run build`.

Optional: point a subdomain such as `crm.testsandfunnels.com` at the CRM host and set `PUBLIC_URL` to it.

## Sending website leads into the CRM

1. Deploy the CRM (above) and open **Website forms** in the dashboard. Copy the **Intake URL**.
2. In GitHub → repo **Settings → Secrets and variables → Actions → Variables**, add `PUBLIC_CRM_INTAKE_URL` with that URL.
3. Push to `main` (or re-run the deploy workflow). Every form now posts a `tf-intake/1` lead to the CRM.

Without the variable, or if the CRM is down, the forms fall back to a prefilled WhatsApp message, so no lead is lost. `CORS_ORIGINS` on the CRM must include the site's origin (default: `https://testsandfunnels.com,https://www.testsandfunnels.com`).
