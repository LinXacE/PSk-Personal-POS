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

- **Purchase** — incoming stock from a Supplier, received into a specific
  Warehouse. See "Purchase module" below.
- **Sales (POS)** — outgoing stock to a Customer.
- **Transfer** — stock moved between warehouses.
- **Stock Adjustment** — manual correction with a reason code.

### Warehouse

Stock is tracked per **Warehouse** — a user-created location (e.g. "Main
Store", "Back Stock"). You can create as many warehouses as you use; every
Purchase Order is received into exactly one warehouse, and every
`StockBatch` / `StockMovement` row is tied to one. A warehouse can't be
deleted while it still has linked purchase orders, batches, or movements.

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
src/app/(dashboard)/warehouses/         Warehouse CRUD (name, address)
src/app/(dashboard)/purchases/          Purchase Order list + create/edit/receive/payment UI
src/app/(dashboard)/customers/           Customer CRUD (name, contact, address)
src/app/(dashboard)/sales/               Sales (POS) list + create/edit/complete UI
src/lib/purchase.ts          Reference/batch-number generation, total + payment-status helpers
src/lib/sales.ts             Reference generation, FEFO batch-picking, total helpers
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
- **Warehouse**: name (unique), address. Delete blocked while it still has
  linked purchase orders, stock batches, or stock movements.
- **Purchase**: full order → receive workflow, payment tracking, and
  batch/expiry-tracked stock intake — see "Purchase module" below.
- **Customer**: name, contact, address — see "Customer module" below.
- **Sales (POS)**: full draft → complete workflow with FEFO batch picking
  — see "Sales (POS) module" below.

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
record of what was actually typed (24, box) for display and receipts.

## Purchase module

The Purchase page (`/purchases`) implements a two-step **order → receive**
workflow, so creating a Purchase Order never moves stock by itself —
only the separate Receive action does.

### Order (draft)

- **Supplier**, **Warehouse** (goods will be received into this
  warehouse), **Currency**, **Order Date**.
- **Reference Number** — Auto-generate (`PO-0001`, sequential) or Manual
  entry, same auto/manual pattern as Product Code.
- **Purchase Lines** — repeatable rows of {Product, entry Unit (any unit
  in that product's unit family, e.g. Box), entry Quantity, Unit Cost}.
  The line's base-unit quantity is computed automatically from the unit's
  conversion factor (24 Box × 10 = 240 Bottle).
- **Amount Paid** — optional, tracked independently of receiving.
- Saving a Purchase Order creates it with status **ORDERED** and no stock
  effect. Creating/editing a line also refreshes that product's
  `defaultPurchasePrice` (converted to a per-base-unit cost) and
  `defaultSupplierId`.
- A draft can be freely edited (or deleted) as long as nothing on it has
  been received yet.

### Receive

- The Receive action lets you enter how much actually arrived for each
  line (independently, and it can be less than what was ordered).
- Each receipt creates a **StockBatch** (lot) with:
  - a **Batch Number** — Auto-generate (`BATCH-YYYYMMDD-XXX`, per day) or
    Manual entry.
  - an optional **Expiry Date**.
  - the per-base-unit cost, carried over from the line's unit cost.
- Each receipt also creates a **StockMovement** (type `PURCHASE`) row
  referencing that batch, so all stock arrivals stay traceable to the lot
  they came from.
- A line can be received across multiple partial receipts; the order's
  status is derived automatically:
  - **ORDERED** — nothing received yet.
  - **PARTIALLY_RECEIVED** — some, but not all, lines are fully received.
  - **RECEIVED** — every line is fully received (`receivedAt` is set).
- Receiving more than a line's remaining quantity is rejected.

### Payment, cancel, and delete rules

- **Payment Status** (`UNPAID` / `PARTIAL` / `PAID`) is derived
  automatically from `amountPaid` vs. the order total, and can be updated
  at any time (even after receiving) via the Payment action.
- **Cancel** is only allowed on an `ORDERED` order that has nothing
  received yet.
- **Delete** is blocked once anything has been received
  (`PARTIALLY_RECEIVED` / `RECEIVED`), since that would leave orphaned
  stock history; `ORDERED` and `CANCELLED` orders can be deleted.
- A full edit (changing supplier/warehouse/lines) is only allowed while
  the order is still `ORDERED`.

## Customer module

- **Customer**: name, contact, address. Not required for a sale — walk-in
  sales simply leave `customerId` unset. Delete blocked while the
  customer still has linked sales, contracts, or service tickets.

## Sales (POS) module

The Sales page (`/sales`) implements a two-step **draft → complete**
workflow, mirroring Purchase's order → receive shape but simpler, since a
sale is always fully paid at checkout and completes in one shot (no
partial completion).

### Draft

- **Customer** (optional — walk-in), **Warehouse** (stock will be
  deducted from here on completion), **Currency**, **Price Group**
  (optional; used only to auto-fill line prices from that product's
  `ProductPrice` rows — always manually overridable), **Sale Date**.
- **Reference Number** — Auto-generate (`SO-0001`, sequential) or Manual
  entry, same pattern as Purchase Order / Product Code.
- **Sales Lines** — repeatable rows of {Product, entry Unit (any unit in
  that product's unit family), entry Quantity, Unit Price}. The line's
  base-unit quantity is computed the same way as Purchase lines.
- Saving a Sale creates it with status **DRAFT** and no stock effect —
  nothing is checked against available stock until you complete it.
- A draft can be freely edited or deleted. There's no separate
  `CANCELLED` status; an unwanted draft is just deleted.

### Complete (FEFO stock deduction)

- The **Complete Sale** action is the only thing that ever deducts stock
  for a sale, and it does so in one all-or-nothing step — there's no
  partial completion like Purchase's `PARTIALLY_RECEIVED`.
- For every line, available `StockBatch` rows for that product in the
  sale's warehouse are consumed **FEFO (First-Expired, First-Out)** —
  soonest `expiryDate` first; batches with no expiry date are treated as
  expiring last; ties are broken by `receivedAt` (oldest received first).
  A single line can draw from multiple batches if the soonest-expiring
  one doesn't have enough on its own — each portion taken is recorded as
  a `SalesOrderLineBatch` row (batch, quantity, unit cost).
- **Oversell is blocked**: if the total requested quantity for any line
  exceeds what's available across all of that product's batches in the
  warehouse, the *entire* completion is rejected with a descriptive error
  (e.g. "Not enough stock for X: requested 35, only 30 available") and no
  stock or order state changes for any line — checked before any
  mutation, inside one transaction.
- On success, each batch portion also creates a `StockMovement` (type
  `SALE`, negative quantity) referencing that batch, so every sale stays
  traceable to the exact lot(s) it drew from — same ledger Purchase writes
  to. The order's `status` becomes **COMPLETED** and `completedAt` is set.

### Locked after completion

- A **COMPLETED** sale is permanent: edit and delete both return a 409,
  and completing it again is rejected. This mirrors a real receipt —
  unlike Purchase, there's no cancel action for a completed (or draft)
  sale beyond deleting the draft itself.
- Payment is always "fully paid at checkout" by design, so — unlike
  Purchase — Sales has no `PaymentStatus` / `amountPaid` fields or Payment
  action at all.

## Status

Actively being built out module by module. Main Category, Sub Category,
Brand, Unit, Currency, Price Group, Supplier, Product, Warehouse,
Purchase, Customer, and Sales (POS) are all fully working end to end.
Purchase covers the full order → receive workflow, auto/manual reference
and batch numbering, expiry dates, payment tracking, and status-based
edit/cancel/delete guards. Sales (POS) covers the draft → complete
workflow with FEFO batch picking, all-or-nothing oversell blocking, and a
fully locked-after-complete order — both modules write to the unified
`StockMovement` ledger via `StockBatch`. Next up: Transfer and Stock
Adjustment, to round out the inventory-driving operations.
