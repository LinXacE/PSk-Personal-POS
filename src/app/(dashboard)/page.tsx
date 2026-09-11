import Link from "next/link";

const MODULES = [
  {
    group: "Inventory",
    items: [
      { label: "Main Category", href: "/main-categories" },
      { label: "Sub Category", href: "/sub-categories" },
      { label: "Brand", href: "/brands" },
      { label: "Unit", href: "/units" },
      { label: "Product", href: "/products" },
    ],
  },
  {
    group: "Pricing",
    items: [
      { label: "Currency", href: "/currencies" },
      { label: "Price Group", href: "/price-groups" },
    ],
  },
  {
    group: "Operations",
    items: [
      { label: "Purchase", href: "/purchases" },
      { label: "Sales (POS)", href: "/sales" },
      { label: "Transfer", href: null },
      { label: "Stock Adjustment", href: null },
    ],
  },
  {
    group: "Partners",
    items: [
      { label: "Supplier", href: "/suppliers" },
      { label: "Warehouse", href: "/warehouses" },
      { label: "Customer", href: "/customers" },
    ],
  },
  {
    group: "Commercial",
    items: [
      { label: "Sales Contracts", href: null },
      { label: "A/C (Accounts)", href: null },
      { label: "AR Sales Contracts", href: null },
    ],
  },
  {
    group: "Service",
    items: [{ label: "Engineer Service Module", href: null }],
  },
];

export default function Home() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        PSk Personal POS
      </h1>
      <p className="mt-2 text-slate-500">
        Inventory, sales, and service management.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {MODULES.map((section) => (
          <div
            key={section.group}
            className="rounded-lg border border-slate-200 bg-white p-5"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {section.group}
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {section.items.map((item) =>
                item.href ? (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-emerald-700 hover:underline"
                    >
                      {item.label}
                    </Link>
                  </li>
                ) : (
                  <li key={item.label} className="text-slate-400">
                    {item.label}{" "}
                    <span className="text-xs">(coming soon)</span>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
