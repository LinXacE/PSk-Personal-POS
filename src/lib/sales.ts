import { prisma } from "@/lib/prisma";

export const EPSILON = 1e-6;

export async function generateSalesReference() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const count = await prisma.salesOrder.count({
      where: { reference: { startsWith: "SO-" } },
    });
    const candidate = `SO-${String(count + 1 + attempt).padStart(4, "0")}`;
    const exists = await prisma.salesOrder.findUnique({ where: { reference: candidate } });
    if (!exists) return candidate;
  }
  return `SO-${Date.now()}`;
}

export type LineTotalInput = { entryQuantity: number; unitPrice: number };

export function computeSalesTotal(lines: LineTotalInput[]) {
  return lines.reduce((sum, l) => sum + l.entryQuantity * l.unitPrice, 0);
}

export type FefoBatchRow = {
  id: string;
  quantityRemaining: number;
  unitCost: number;
  expiryDate: Date | null;
  receivedAt: Date;
};

export type FefoAllocation = { batchId: string; quantity: number; unitCost: number };

// Picks batch(es) to cover `neededBaseQty` units of a product in a warehouse,
// soonest-expiry first (batches with no expiry are treated as expiring last,
// so perishable stock is always preferred first); ties broken by received
// date (oldest first). Returns `ok:false` with the total actually available
// when there isn't enough stock to cover the request (sale is blocked).
export function planFefoAllocation(
  batches: FefoBatchRow[],
  neededBaseQty: number,
): { ok: true; allocations: FefoAllocation[] } | { ok: false; available: number } {
  const sorted = [...batches].sort((a, b) => {
    const aTime = a.expiryDate ? a.expiryDate.getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.expiryDate ? b.expiryDate.getTime() : Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;
    return a.receivedAt.getTime() - b.receivedAt.getTime();
  });

  const available = sorted.reduce((sum, b) => sum + b.quantityRemaining, 0);
  if (available < neededBaseQty - EPSILON) {
    return { ok: false, available };
  }

  const allocations: FefoAllocation[] = [];
  let remaining = neededBaseQty;
  for (const batch of sorted) {
    if (remaining <= EPSILON) break;
    if (batch.quantityRemaining <= EPSILON) continue;
    const take = Math.min(batch.quantityRemaining, remaining);
    allocations.push({ batchId: batch.id, quantity: take, unitCost: batch.unitCost });
    remaining -= take;
  }
  return { ok: true, allocations };
}
