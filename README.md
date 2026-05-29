# OpScheduler

**OpScheduler** is an internal operations management portal designed for F&B and retail teams. It handles multi-outlet staff scheduling, runner (floater) management, and Singapore statutory leave tracking — all in a single browser-based app with no backend required.

> Built with React 18 + Vite 6. All data is stored in the browser's localStorage — no server, no database, no environment variables needed.

---

## Features

| Module | Description |
|--------|-------------|
| **Dashboard** | Overview stats (staff, outlets, leave counts), today's leave & off-day lists, *For Your Action* card (pending approvals + notifications + understaffing), and 14-day upcoming leave grid |
| **Employees** | Staff profiles with hire date, contracted hours, base outlet, and Runner (floater) toggle |
| **Outlets** | Outlet setup with 16hr / 24hr / custom shift configurations and staffing thresholds |
| **Deployments** | Weekly deployment grid (per outlet, per shift) + monthly Runner Roster view with outlet colour coding |
| **Leaves** | 7 Singapore statutory leave types, Off Day auto-approval, service eligibility warnings (3-month rule), AL entitlement calculator, tab count badges |
| **Alerts** | System-generated notifications (upcoming leave, understaffing) |
| **Reports** | Reporting module (placeholder) |
| **Audit Log** | Full action history (create / update / approve / reject) |
| **User Management** | Admin-only — manage portal users with admin / manager roles |

### Leave Types Supported
`Annual Leave` · `Medical Leave` · `Hospitalisation Leave` · `Maternity Leave` · `Paternity Leave` · `Compassionate Leave` · `Off Day`

### Singapore Employment Act Compliance
- Annual Leave: starts 7 days, +1/year, capped at 14 days
- Medical / Hospitalisation Leave: pro-rated between months 3–6 of service
- All non-AL leave: requires 3 months continuous service (warning shown, non-blocking)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 |
| Build Tool | Vite 6 |
| Routing | React Router v6 (BrowserRouter, nested routes, auth guards) |
| State / Data | TanStack Query v5 + `useState` / `useEffect` |
| UI Components | Tailwind CSS + shadcn/ui (Radix UI) |
| Icons | lucide-react |
| Date Utilities | date-fns |
| **Data Persistence** | **Browser localStorage** (no backend) |

---

## Default Login Credentials

| Account | Email | Password | Access |
|---------|-------|----------|--------|
| **Admin** | `admin@ops.local` | `Admin1234` | Full access including User Management |
| **Manager** | `manager@ops.local` | `Manager1234` | Full access excluding User Management |

> **First time setup:** If the login page appears but credentials are rejected, open browser DevTools → Console and run:
> ```js
> localStorage.clear(); location.reload();
> ```
> This resets the seed data (v4) and creates both accounts fresh.

---

## Getting Started

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm

### Run Locally

```bash
# 1. Enter the project directory
cd ops-scheduler

# 2. Install dependencies
pnpm install
# or: npm install

# 3. Start the development server
pnpm dev
# or: npm run dev

# 4. Open in browser
# → http://localhost:5173
```

No `.env` file needed. No API keys. No backend setup.

### Build for Production

```bash
pnpm build
# Output: dist/
```

The `dist/` folder is a fully static site — upload to any static host.

---

## Project Structure

```
ops-scheduler/
├── src/
│   ├── pages/                  # Page-level components
│   │   ├── Dashboard.jsx       # Main overview dashboard
│   │   ├── Employees.jsx       # Staff management
│   │   ├── Outlets.jsx         # Outlet & shift configuration
│   │   ├── Deployments.jsx     # Weekly roster + Runner Roster
│   │   ├── Leaves.jsx          # Leave management & approvals
│   │   ├── Alerts.jsx          # System alerts
│   │   ├── Reports.jsx         # Reports (placeholder)
│   │   ├── AuditLog.jsx        # Action audit trail
│   │   ├── UserManagement.jsx  # Portal user admin (admin only)
│   │   └── Login.jsx           # Login page
│   ├── components/
│   │   ├── Layout.jsx          # Sidebar navigation + layout shell
│   │   └── ui/                 # shadcn/ui component library (40+ components)
│   ├── lib/
│   │   ├── db.js               # LocalStorage database adapter (CRUD API)
│   │   ├── seed.js             # Auto-seed on first load (v4)
│   │   └── AuthContext.jsx     # Auth context: useAuth(), login(), logout()
│   ├── App.jsx                 # Route tree + RequireAuth / RequireAdmin guards
│   └── main.jsx                # App entry point (calls seedIfEmpty on boot)
├── index.html
├── vite.config.js              # Vite config with @ → src/ alias
├── tailwind.config.js
├── components.json             # shadcn/ui config
└── package.json
```

---

## Data Storage

All data lives in the browser's `localStorage`. No external services required.

| localStorage Key | Content |
|------------------|---------|
| `ops_Employee` | Employee records |
| `ops_Outlet` | Outlet records with shift configurations |
| `ops_Deployment` | Daily shift assignments |
| `ops_Leave` | Leave / Off Day records |
| `ops_Alert` | System alerts |
| `ops_AuditLog` | Action audit trail |
| `ops_AppUser` | Portal user accounts |
| `ops_current_user` | Active session (logged-in user) |
| `ops_seeded_v4` | Seed guard (prevents re-seeding) |

> ⚠️ Data is browser-local. Clearing browser data or switching browsers will reset all records.
> Passwords are encoded with `btoa(encodeURIComponent(password))` — suitable for a local internal tool, not for public deployment.

---

## Seed Data (v4)

On first load, the app seeds the following demo data:

- **2 portal users** — Admin + Manager
- **3 outlets** — Central Hub (16hr), West Wing (24hr), North Point (16hr)
- **6 employees** — including 2 runners (Eva Koh, Felix Ong)
- **Deployments** — current week Mon–Fri
- **5 leave records** — covering AL, ML, HL, CL, Off Day
- **1 alert** — upcoming leave notification

---

## Deployment

This is a pure frontend static application. No server required.

### Option 1 — Any Static Host
```bash
pnpm build
# Upload dist/ to Vercel, Netlify, GitHub Pages, or any CDN
```

### Option 2 — Tencent Cloud COS
1. Run `pnpm build` to generate `dist/`
2. Upload `dist/` contents to a COS bucket with static website hosting enabled
3. Set index document to `index.html` and error document to `index.html` (for SPA routing)

### Option 3 — Tencent CloudBase (TCB) Static Hosting
1. Install CloudBase CLI: `npm install -g @cloudbase/cli`
2. Login: `tcb login`
3. Run `pnpm build`
4. Deploy: `tcb hosting deploy dist/ -e <your-env-id>`

---

## Notes

- This project was migrated from the Base44 closed-sandbox platform and fully rebuilt as a standalone Vite + React app
- The original Base44 SDK (`@base44/sdk`) and plugin have been removed
- All `db.auth.me()` calls replaced with `useAuth()` hook from `AuthContext.jsx`
- Seed version guard ensures safe re-seeding when data schema changes (current: v4)
