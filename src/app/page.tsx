const MODULES = [
  {
    group: "Inventory",
    items: ["Main Category", "Sub Category", "Brand", "Unit", "Product"],
  },
  {
    group: "Operations",
    items: ["Purchase", "Sales (POS)", "Transfer", "Stock Adjustment"],
  },
  {
    group: "Partners",
    items: ["Supplier", "Customer"],
  },
  {
    group: "Commercial",
    items: ["Sales Contracts", "A/C (Accounts)", "AR Sales Contracts"],
  },
  {
    group: "Service",
    items: ["Engineer Service Module"],
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">PSk Personal POS</h1>
      <p className="mt-2 text-neutral-500">
        Inventory, sales, and service management — scaffolded from the project
        spec.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {MODULES.map((section) => (
          <div
            key={section.group}
            className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {section.group}
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {section.items.map((item) => (
                <li key={item} className="text-neutral-800 dark:text-neutral-200">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
