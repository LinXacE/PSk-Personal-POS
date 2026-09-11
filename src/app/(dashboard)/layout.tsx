import Link from "next/link";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "./logout-button";

const NAV_LINKS = [
  { href: "/main-categories", label: "Main Category" },
  { href: "/sub-categories", label: "Sub Category" },
  { href: "/brands", label: "Brand" },
  { href: "/units", label: "Unit" },
  { href: "/products", label: "Product" },
  { href: "/currencies", label: "Currency" },
  { href: "/price-groups", label: "Price Group" },
  { href: "/suppliers", label: "Supplier" },
  { href: "/warehouses", label: "Warehouse" },
  { href: "/purchases", label: "Purchase" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-lg font-bold text-emerald-700">
              PSk Personal POS
            </Link>
            <nav className="flex gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {session && (
              <span className="text-sm text-slate-500">
                Signed in as <strong>{session.username}</strong>
              </span>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
