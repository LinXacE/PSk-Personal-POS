import { prisma } from "@/lib/prisma";
import { CurrencyClient } from "./currency-client";
import type { CurrencyDTO } from "@/types/settings";

export default async function CurrenciesPage() {
  const rows = await prisma.currency.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { prices: true } } },
  });

  const currencies: CurrencyDTO[] = rows.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    isDefault: c.isDefault,
    exchangeRate: c.exchangeRate,
    productPriceCount: c._count.prices,
  }));

  return <CurrencyClient currencies={currencies} />;
}
