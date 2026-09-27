# Hospital Management System

Next.js frontend and Express/Prisma backend for a hospital management system:
patients, doctors, nurses, appointments, admissions, pharmacy, lab, billing and
accounting.

## Requirements

- Node.js 20+
- A MySQL 8 (or MariaDB 10.6+) server. It does **not** need a database created;
  `npm run setup` does that.

## Setup on a fresh clone

```bash
git clone <repo-url>
cd hospital-frontend

npm install                 # frontend dependencies
npm install --prefix backend   # backend dependencies

copy backend\.env.example backend\.env     # Windows
# cp backend/.env.example backend/.env     # macOS / Linux
```

Edit `backend/.env` and set at least:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | `mysql://USER:PASSWORD@HOST:PORT/hospital_management` |
| `JWT_SECRET` | Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |

`SEED_ADMIN_PASSWORD` also matters — it becomes the first login's password.

Then run the single setup command:

```bash
npm run setup
```

That is safe to re-run and performs, in order:

1. checks `.env` for missing or placeholder values
2. generates the Prisma client
3. creates the database if the server does not have it yet
4. applies migrations with `prisma migrate deploy`
5. seeds reference data

Finally start both servers in two terminals:

```bash
npm run dev                  # frontend -> http://localhost:3000
npm run dev --prefix backend # backend  -> http://localhost:5000
```

Sign in with `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` (default
`admin` / `ChangeMe123!`).

## What the seed creates

Everything the UI needs to be usable, so no screen starts empty in a way that
looks like a bug:

- **Login** — roles, permissions, and a bootstrap `SUPER_ADMIN` account.
- **Branch** — one branch (`SEED_BRANCH_NAME` / `SEED_BRANCH_CODE`). Add more in
  the UI; the address dataset is copied into each one.
- **Address hierarchy** — 8 divisions, 64 districts, 26 thanas and 495 upazilas
  from `@bangladeshi/bangladesh-address`, written to Master Data per branch. This
  is what fills the Division / District / Thana-Upazila cascade on the patient
  form.
- **Departments**, service categories and services.
- **Shift types** — Morning, Evening, Night, used by the nurse Shift dropdown.
- **Master data** — visit types, blood groups, marital status, gender, payment
  methods, document types.
- **Settings** — the hospital, OPD/IPD/lab/pharmacy/billing/accounting/HR/
  inventory groups, localization and system maintenance rows.

The seed is idempotent: run it as many times as you like. Reference rows are
matched on their natural keys, and address rows that disappear from the national
dataset are deactivated rather than deleted so existing patients keep a valid
reference.

## Everyday commands

Run from the repo root:

| Command | Purpose |
|---|---|
| `npm run setup` | Full bootstrap (above). Use on a new machine. |
| `npm run db:migrate` | Apply migrations. Run after pulling schema changes. |
| `npm run db:seed` | Re-seed reference data. |
| `npm run db:studio` | Open Prisma Studio to inspect the database. |
| `npm run dev` | Frontend dev server. |
| `npm run dev --prefix backend` | Backend dev server. |
| `npm run build` | Frontend production build. |

From `backend/`:

| Command | Purpose |
|---|---|
| `npm test` | Backend test suite. |
| `npm run typecheck` | Backend type check. |
| `npm run db:migrate:dev` | Create a new migration while changing the schema. |
| `npm run seed:address` | Re-sync the address dataset only, e.g. after bumping the source package. |

### Changing the schema

Use `npm run db:migrate:dev` in `backend/` and commit the generated folder in
`backend/prisma/migrations/`. Do not use `prisma db push` — it mutates the
database without recording a migration, so the next person to run
`npm run setup` gets a different schema than you have.

## Notes

- The frontend proxies `/api/*` to the backend, so the browser stays
  same-origin and the auth cookie is sent automatically. Override the target with
  `BACKEND_URL` in `.env.local` if the API is not on `localhost:5000`.
- The seed refuses to run when `NODE_ENV=production` unless you also set
  `SEED_ALLOW_PRODUCTION=true`, because it writes a login with a known password.
- `npm run lint` is currently broken by a pre-existing ESLint/plugin version
  mismatch, independent of these changes. Use `npm run typecheck`, `npm test`
  and `npm run build` as the gates.
