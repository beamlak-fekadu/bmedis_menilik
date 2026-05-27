# BMEDIS

BMEDIS is a biomedical equipment management information system developed as a thesis project for hospital equipment operations. It supports equipment inventory, maintenance workflows, preventive maintenance, calibration, spare parts, procurement, reporting, QR-based asset access, notifications, offline-capable workflows, and decision-support views for biomedical engineering teams.

The project is built for the Menelik II Hospital thesis/demo dataset and uses role-based access control so hospital users, biomedical engineers, store users, department users, administrators, and read-only viewers see workflows appropriate to their responsibilities.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, RLS, RPCs, and migrations
- Chart.js / react-chartjs-2
- jsPDF and jsPDF AutoTable for reports
- ExcelJS for spreadsheet import/export
- html5-qrcode and qrcode.react for QR workflows

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Set the required Supabase and application configuration values in `.env.local`. Do not commit real keys or secrets.

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

The app expects Supabase project configuration, application URL configuration, and optional service integrations through environment variables. Typical local variables include:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `SITE_URL`
- `CRON_SHARED_SECRET`
- Optional provider keys for enabled integrations

Server-only secrets must never be exposed through `NEXT_PUBLIC_*` variables.

## Database Setup

Database schema changes are stored in `supabase/migrations`. Apply migrations to the linked Supabase project before running a full demo or validation pass.

Useful project scripts:

```bash
npm run setup:demo-users
npm run setup:menelik-users
npm run import:menelik:dry-run
npm run import:menelik
npm run validate:menelik
```

## Thesis and Demo Notes

The repository includes supporting thesis/demo materials under `documents/` and `supabase/menelikII-data/`. These files document the sample dataset, validation checklists, workflow evidence, and results used for project review.

The application is intended for academic demonstration and evaluation. Operational deployment should include environment review, Supabase policy verification, role mapping validation, and live workflow testing.

## Verification

Run the main checks before submitting or deploying:

```bash
npm run lint
npm run test:system-fix
npm run build
```

For focused assistant workflow tests:

```bash
npm run test:chatbot
```
