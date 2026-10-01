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
- **Address hierarchy** — not seeded. Loaded from a SQL file you upload; see
  [Address data](#address-data) below.
- **Departments**, service categories and services.
- **Shift types** — Morning, Evening, Night, used by the nurse Shift dropdown.
- **Master data** — one table per list: visit types, blood groups, payment
  methods and document types. Each list is branch-scoped except payment methods,
  which are global. The national address lists (divisions, districts, upazilas,
  unions) are separate and loaded from SQL, not seeded.
- **Settings** — the hospital, OPD/IPD/lab/pharmacy/billing/accounting/HR/
  inventory groups, localization and system maintenance rows.

The seed is idempotent: run it as many times as you like. Reference rows are
matched on their natural keys.

## Address data

The Division / District / Upazila cascade on the patient form reads from Master
Data, and that data is **not** seeded — it is loaded once from a SQL file you
upload yourself. `npm run setup` deliberately leaves it alone, so re-running
setup can never overwrite it.

The dataset lives in `backend/prisma/address-source/` as the four published
dumps (`divisions`, `districts`, `upazilas`, `unions`):

| Level | Rows | Bengali name | Coordinates | URL |
|---|---|---|---|---|
| `divisions` | 8 | yes | – | yes |
| `districts` | 64 | yes | yes | yes |
| `upazilas` | 494 | yes | – | yes |
| `unions` | 4540 | yes | – | yes |

That is 5106 rows per branch. `unions` is the deepest level and is served by
`GET /api/settings/address/unions`; the patient form stops at `upazilas`. The
dataset has no metropolitan thanas of its own, so the upazila dropdown also
serves as the thana.

### Loading it

Generate the upload file, then import it in phpMyAdmin (or any MySQL client):

```bash
npm run seed:address:sql --prefix backend
```

That writes `backend/sql/address-master-data.sql`. Upload it against the
database in `DATABASE_URL`, **after** `npm run setup` has run so the branches
exist. The file is safe to upload more than once: it deletes the address rows
and re-inserts them in one transaction, and it leaves every other Master Data
category (blood groups, visit types, document types, payment methods) untouched. It
ends with a `SELECT` showing the per-branch counts, so you can confirm the load.

Branch ids are read from the database the generator connects to and written into
the file as literals, so it only fits the branches that existed when it was
generated. Run it against production after seeding, or the rows land on the
wrong branch.

Prefer a script to an upload? `npm run seed:address --prefix backend` writes
the same rows through Prisma and reads the branches itself, so it has no such
constraint. It matches rows on `(branchId, code)` (and `(branchId, parentId,
name)` within the hierarchy) and deactivates rows the dataset no longer lists,
so it is also the safe way to refresh after editing the dumps. **This is the
recommended path for production if you have shell access.** It has not been
tested against a database that still holds the old dataset's codes, so the
upload path is the one verified end to end.

### Editing the data

Address rows are read-only in the UI, and the write endpoints refuse them too.
Changing a place means editing the dumps and re-importing, because an admin edit
can break the unique keys the cascade depends on: `(branchId, code)` on each
table and `(branchId, parentId, name)` on districts, upazilas and unions.

The dumps repeat four union names inside a single upazila — `Natai` under
Brahmanbaria Sadar, `Awajpur` under Charfasson, `Talimpur` under Barlekha and
`Bhojoanpur` under Tetulia. A union table cannot store two rows with the same
parent and name, so the second of each pair is kept as `Natai (2)` and so on
rather than dropped. `npm run seed:address:sql` prints the list.

Patients store the place name as text, not the code, so re-importing does not
rewrite existing records; their saved division/district/upazila/thana text stays
as it was.

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
| `npm run seed:address` | Re-sync the address dataset from `prisma/address-source` only. |
| `npm run seed:address:sql` | Regenerate `sql/address-master-data.sql` for upload. |

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
