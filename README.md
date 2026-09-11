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
src/app/(dashboard)/sub-categories/     Sub Category CRUD (linked to a Main Category)
src/app/(dashboard)/brands/             Brand CRUD (list, create, edit, delete)
src/app/(dashboard)/units/              Unit CRUD (base + purchase/selling conversions)
src/app/(dashboard)/currencies/         Currency CRUD (code, name, exchange rate, default)
src/app/(dashboard)/price-groups/       Price Group CRUD (e.g. Retail, Wholesale, VIP)
src/app/(dashboard)/suppliers/          Supplier CRUD (name, contact, address)
src/app/(dashboard)/products/           Product list + full create/edit form
src/app/api/                 REST API routes backing the pages above
src/components/ui/           Shared Button and Modal components
```

## Implemented so far

- **Auth**: login/logout, session-protected routes, seeded admin user.
- **Main Category**: list with Product/Service filter, create, edit,
  delete (blocked while sub-categories or products are still linked).
- **Sub Category**: create/edit/delete under any Main Category (Product or
  Service), delete blocked while products are still linked.
- **Brand**: list, create, edit, delete (blocked while products are still
  linked).
- **Unit**: define a base unit (e.g. "bottle") plus purchase/selling units
  that convert to it with a quantity (e.g. "box" = 10 bottles). A unit
  can't be deleted while other units or products still reference it.
- **Currency**: code (e.g. MMK, USD), name, exchange rate relative to the
  default currency, and an exclusive "default currency" flag (setting one
  default automatically clears any other). Delete blocked while any
  `ProductPrice`, purchase, or sale still references it.
- **Price Group**: name (e.g. Retail, Wholesale, VIP) with the same
  exclusive "default" flag pattern. Delete blocked while linked
  `ProductPrice` rows exist.
- **Supplier**: name (unique), contact, address. Delete blocked while it's
  a product's default supplier or has linked purchases.
- **Product**: the full product record — see "Product module" below.

## Product module

The Product page (`/products`) ties every other lookup module together:

- **Name** and **Category** — a required Main Category (cascades to an
  optional Sub Category filtered to that Main Category) and an optional
  Brand.
- **Base Unit** — required; must be a `BASE`-kind Unit. All stock for this
  product is tracked in this unit (see "Unit conversion rule" below).
- **Product Code** — user picks **Auto-generate** (derived from the Main
  Category + Brand + a sequence number, e.g. `BEVERAGES-0001`) or
  **Manual** entry (uniqueness-checked). Tracked via the `codeIsAuto` flag
  so it can be changed later.
- **Barcode** — a single field per product with a source toggle:
  **System-generated** (a unique code assigned on save) or **Original**
  (the manufacturer's own barcode, typed in and uniqueness-checked).
- **Selling prices** — a repeatable table of {Price Group, Currency,
  Price} rows, so the same product can have different prices per
  Price Group *and* per Currency at the same time (no duplicate
  Price Group + Currency combinations allowed on one product).
- **Default Purchasing Price** and **Default Supplier** — the latest/
  preferred purchase price and supplier (actual purchase history will
  live on `PurchaseOrderLine` once the Purchase module is built).
- **General Data** — a free-form key/value editor for spec-sheet fields
  (e.g. Color, Size, Weight), stored as JSON.
- Product documents (FDA/NHL certificates) are intentionally **not** part
  of this page — they'll live in their own module later.
- Deleting a product is blocked while it has purchase, sales, stock, or
  contract history.

## Unit conversion rule

Stock is always kept in a product's smallest **base unit**, no matter what
unit was used to enter a transaction. For example, if 1 box = 10 bottles
and someone purchases 24 boxes, the system stores 240 bottles in stock —
the `quantity` on `PurchaseOrderLine` / `SalesOrderLine` / `StockMovement`
is always the base-unit amount, while `entryQuantity` + `entryUnit` keep a
record of what was actually typed (24, box) for display and receipts. This
conversion is defined in the schema now and will be wired into the
Purchase/Sales/Stock forms when those modules are built.

## Status

Actively being built out module by module. Main Category, Sub Category,
Brand, Unit, Currency, Price Group, Supplier, and the full Product module
are fully working end to end (create/edit/delete, including auto/manual
code, system/original barcode, and multi price-group/currency pricing).
Next up: Purchase and Sales, which will read from Product's default unit,
supplier, and pricing to build the unified stock ledger.
