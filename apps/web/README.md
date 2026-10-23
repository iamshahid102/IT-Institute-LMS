# @lms/web — Next.js PWA

Next.js 15 App Router application for staff operations and the student portal. React 19, TypeScript strict,
Tailwind, shadcn-style components, TanStack Query/Table, React Hook Form + Zod. Installable PWA with an
app-shell service worker.

## Setup

```bash
cp .env.example .env      # API_ORIGIN, defaults to http://127.0.0.1:4000
npm install               # from the repository root
npm run dev               # http://localhost:3000
```

The browser calls `/api/v1/*` on its own origin; `next.config.ts` rewrites that prefix to `API_ORIGIN`. Keeping the
cookies first-party is what makes the CSRF protection meaningful. In production, route the same prefix to the API
behind the reverse proxy.

## Route map

- `/login`, `/forgot-password`, `/reset-password` — authentication.
- `/admin/*` — Super Admin: dashboard, students, enrollments, courses, batches, schedules, instructors, attendance
  sessions/roster/scanner/reports, fee plans, invoices, payments, dues, receipts, assessments, certificates,
  announcements, reports, staff accounts, audit log, institute settings.
- `/front-desk/*` — Front Desk Manager: dashboard, admissions, students, enrollments, attendance sessions/scanner/
  manual entry, payment collection, invoices and dues, receipts, announcements, operational reports.
- `/student/*` — Student portal: overview, courses, batches/timetable, attendance, fee overview, ledger, receipts,
  certificates, announcements, notifications, profile, account settings.
- `/verify-certificate` and `/verify-certificate/[code]` — public certificate verification.
- `/offline` — offline fallback for the service worker.

Navigation per role lives in `src/components/layout/navigation.ts` and is filtered by the permission list the API
returns for the signed-in user. Hiding a link is a convenience only: every action is authorised again by the API.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (`next/core-web-vitals` + TypeScript) |
| `npm run test:e2e` | Playwright journeys (uses installed Chrome) |

## End-to-end tests

`playwright.config.ts` starts the built API and web servers (or reuses running ones on ports 4000/3000) and runs
`e2e/*.spec.ts` in desktop Chrome. `e2e/global-setup.ts` signs the seeded roles in once and stores the session
state under `e2e/.auth/` (git-ignored), which avoids tripping the API's sign-in rate limiter.

Prerequisites:

```bash
npm run db:start            # repository root: local PostgreSQL
npm run db:migrate && npm run db:seed
npm run build               # production builds for both apps
npm run test:e2e            # 19 journeys
```

The suite covers anonymous redirects, invalid-credential handling, the staff dashboard, mobile navigation, course
creation through the UI, student record navigation, the student dashboard/attendance/fees/profile, staff-area
protection for students, public certificate verification for issued and revoked certificates, manifest and
service-worker installation prerequisites, and the offline page.

## PWA notes

- `public/manifest.webmanifest` declares name, icons (192/512/maskable), theme colour and `display: standalone`.
- `public/sw.js` caches only the public app shell and static assets. It never caches `/api/*`, authenticated HTML,
  receipts or certificate PDFs, and it never reports an offline write as successful.
- Camera access is requested only inside the attendance scanner and is served over HTTPS; a manual student-number
  fallback is always available.
