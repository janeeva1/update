# NYSC Update Frontend

This directory contains the frontend implementation for the NYSC admin **payment and graduands management system**. The frontend is a Next.js (App Router) client application, separate from the Laravel backend views (`../mark`), and communicates with the backend via API endpoints.

## Tech Stack



- **Next.js 13** (App Router, `app/` directory) with React + TypeScript
- **Tailwind CSS** for styling
- **shadcn/ui** components (`components/ui`)
- **Sonner** for toast notifications
- **Recharts** for dashboard/statistics graphs
- **Laravel backend** (`../mark`) exposes the REST API consumed by this app

## Getting Started

```bash
npm install
npm run dev
```

The app expects the backend API to be running. The API base URL defaults to `http://localhost:8000/` and can be configured via the `NEXT_PUBLIC_API_BASE_URL` environment variable (see `.env` / `.env.local`).

### Scripts

| Command       | Description                          |
| ------------- | ------------------------------------ |
| `npm run dev` | Start the development server         |
| `npm run build` | Production build                  |
| `npm run start` | Start the production server       |
| `npm run lint`  | Run ESLint on the project         |

## Authentication & Authorization

Login is handled via the Auth context (`contexts/AuthContext`). The app supports three user types:

- **admin** – manages data, payments, sessions, roles, and imports
- **staff** – supports administrative workflows
- **student** – submits/examines their own records and payments

Routes are protected with `ProtectedRoute` and permission checks (e.g. `hasPermission("canManageSystem")`). The JWT token is stored in `localStorage` under `nysc_token` and sent with API requests.

## Project Structure

```
app/                 # Next.js App Router pages (routes) & client components
  admin/             # Admin-only pages
  student/           # Student-facing pages
  staff/             # Staff pages
  login/             # Login page
components/          # Reusable React components
  admin/             # Admin feature components (e.g. ImportReviewTable, NyscExportButton)
  common/            # Layout/theme components (Navbar, Sidebar, ProtectedRoute, LoadingSpinner)
  ui/                # shadcn/ui primitives (Card, Button, Badge, Alert, ...)
contexts/            # React context providers (AuthContext, ...)
hooks/               # Custom hooks
services/            # API client services (admin.service, auth.service, ...)
types/               # TypeScript types/interfaces
utils/               # Helper utilities
assets/              # Static assets
public/              # Public files
```

## Key Pages / Features

### Admin

| Route              | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| `/admin/dashboard` | Overview dashboard with stats and charts             |
| `/admin/students`  | Student management                                   |
| `/admin/payments`  | Payment management, details, and pending records     |
| `/admin/sessions`  | NYSC session management                              |
| `/admin/roles`     | Role and permission management                       |
| `/admin/docx-import` | Import GRADUANDS (`.docx`/`.csv`) records         |
| `/admin/graduands-review` | Review, approve, and enforce class-of-degree updates from the GRADUANDS file |
| `/admin/excel-import` | Import data from Excel spreadsheets              |
| `/admin/csv-export` | Export data to CSV                                 |
| `/admin/exports`   | Export management                                    |
| `/admin/data-analysis` | Data analysis reports                            |
| `/admin/duplicate-payments` | Detect and review duplicate payments       |
| `/admin/payment-statistics` | Payment statistics                          |
| `/admin/prepared-lists` | Manage prepared lists                           |
| `/admin/settings`  | Application settings                                |
| `/admin/roles`     | Role management                                     |

### Student

| Route            | Purpose                               |
| ---------------- | ------------------------------------- |
| `/student`       | Student dashboard                     |
| `/student/profile` | View/edit personal profile          |
| `/student/payment` | Make or view payments              |
| `/student/confirm` | Confirm details                    |
| `/student/updated-info` | View updated information      |
| `/student/payment-history` | View payment history     |

## Graduands Review (`/admin/graduands-review`)

This page processes a GRADUANDS file (`.docx` or `.csv`) against students who have a `NULL` class of degree:

1. **Matching** – extracts matric numbers and class of degree from the file and matches them against the database (exact and similar matches).
2. **Review & Approve** – admin selects rows to apply the proposed class-of-degree updates.
3. **Enforcement** (`Preview Enforcement`) – dry-run preview showing which records would be kept, nullified (not in DOCX), or updated, before applying selected actions.
4. **Unmatched Records** – records from the file that couldn't be matched to a database student. A **Download CSV** button lets the admin export these unmatched records (separate `Matric_No` and `Class_of_Degree` columns) — this export is generated entirely on the client from the already-loaded match data.
5. **Upload** – upload a new GRADUANDS file and tie it to an NYSC session and graduation date.

## API Services

All API calls are centralized in `services/`. The main one, `admin.service`, wraps calls to the Laravel backend (e.g. `getGraduandsMatches`, `applyGraduandsUpdates`, `enforceDegreesFromDocx`, `exportStudentNyscData`). Add new endpoints there using the established patterns.
