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

# Point DATABASE_URL (in .env) at your own PostgreSQL instance
npx prisma migrate dev --name init

npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Project structure

```
prisma/schema.prisma     Database schema for all modules above
src/app/                 Next.js App Router pages & API routes
src/lib/prisma.ts        Shared Prisma client instance
```

## Status

Early scaffold: schema and base layout are in place. Module UIs and API
routes are being built out incrementally, one module at a time.
