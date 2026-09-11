import { prisma } from "@/lib/prisma";
import { CustomerClient } from "./customer-client";
import type { CustomerDTO } from "@/types/settings";

export default async function CustomersPage() {
  const rows = await prisma.customer.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { sales: true, contracts: true, serviceTickets: true } } },
  });

  const customers: CustomerDTO[] = rows.map((c) => ({
    id: c.id,
    name: c.name,
    contact: c.contact,
    address: c.address,
    salesCount: c._count.sales,
  }));

  return <CustomerClient customers={customers} />;
}
