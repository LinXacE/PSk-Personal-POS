# PSk Personal POS

A personal Point-of-Sale / inventory management system, built with Next.js
(TypeScript, App Router), Tailwind CSS, and Prisma + PostgreSQL.

## Tech stack

- **Frontend & backend:** Next.js (App Router, TypeScript) — one unified codebase for UI and API routes.
- **Database:** PostgreSQL via Prisma ORM.
- **Styling:** Tailwind CSS.

## Project scope

The system is organized into the following modules, based on the initial
project spec:

### 1. Inventory module

- **Main Category** — name editable freely; blocked from deletion while it
  has linked sub-categories or products; flagged as `PRODUCT` or `SERVICE`.
- **Sub Category** — name editable freely; blocked from deletion while it
  has linked products.
- **Brand** — editable freely; blocked from deletion while it has linked
  products.
- **Unit** — base unit, purchase unit, and selling unit, with a conversion
  quantity back to the base unit (e.g. 1 carton = 24 pcs). Purchase unit
  defaults to the base unit.

### 2. Product

- Product Name, Product Code (unique).
- Category (main + sub), Brand, Unit.
- General data (free-form spec sheet, stored as JSON).
- Purchasing price (latest, tracked via Purchase Order lines) and Supplier.
- Selling price by Price Group and Currency (price shown in the default
  currency unless otherwise specified).
- Barcode: either the product's original manufacturer barcode, or a
  system-generated one (sequential or random).
- Attached documents (e.g. FDA / NHL certificates) stored per product.

### 3. Core inventory-driving operations

All of the following write to a single, unified stock ledger
(`StockMovement`):

- **Purchase** — incoming stock from a Supplier.
- **Sales (POS)** — outgoing stock to a Customer.
- **Transfer** — stock moved between warehouses.
- **Stock Adjustment** — manual correction with a reason code.

### 4. Commercial modules

- **Supplier** management.
- **Sales Contracts** — with status tracking (draft → active → fulfilled).
- **A/C (Accounts) module** — accounting entries tied to sales/purchases
  (to be built out).
- **AR Sales Contracts** — accounts-receivable tracking for contract-based
  sales.

### 5. Engineer Service module

- Service tickets with status (open / in progress / completed / cancelled),
  scheduling, and assignment.

### Multi-currency

Prices and orders carry a `Currency` (e.g. MMK, USD) with an exchange rate
relative to a configurable default currency.

## Getting started

```bash
npm install

# Copy the example env file and fill in your own values
cp .env.example .env

# Point DATABASE_URL (in .env) at your own PostgreSQL instance, then:
npx prisma migrate dev --name init

# Create the first admin login (uses SEED_ADMIN_USERNAME/PASSWORD from .env)
npm run db:seed

npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the
seeded admin account.

## Authentication

Simple username/password auth backed by the `User` table (passwords hashed
with bcrypt). On login, a signed JWT session is set as an httpOnly cookie;
a proxy (middleware) guards every route except `/login` and
`/api/auth/login`, redirecting unauthenticated visitors to sign in first.

## Project structure

```
prisma/schema.prisma        Database schema for all modules above
prisma/seed.ts              Creates the first admin user
src/proxy.ts                Route guard — redirects unauthenticated requests to /login
src/lib/auth.ts              Session (JWT) helpers
src/lib/prisma.ts            Shared Prisma client instance
src/app/login/               Login page
src/app/(dashboard)/         Authenticated app shell + module pages
src/app/(dashboard)/main-categories/   Main Category CRUD (list, create, edit, delete)
src/app/(dashboard)/brands/             Brand CRUD (list, create, edit, delete)
src/app/api/                 REST API routes backing the pages above
src/components/ui/           Shared Button and Modal components
```

## Implemented so far

- **Auth**: login/logout, session-protected routes, seeded admin user.
- **Main Category**: list with Product/Service filter, create, edit,
  delete (blocked while sub-categories or products are still linked).
- **Brand**: list, create, edit, delete (blocked while products are still
  linked).

## Status

Actively being built out module by module. Next up: Sub Category and Unit,
followed by the full Product page.
