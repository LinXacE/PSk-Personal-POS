import { prisma } from "@/lib/prisma";

export async function generatePurchaseReference() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const count = await prisma.purchaseOrder.count({
      where: { reference: { startsWith: "PO-" } },
    });
    const candidate = `PO-${String(count + 1 + attempt).padStart(4, "0")}`;
    const exists = await prisma.purchaseOrder.findUnique({ where: { reference: candidate } });
    if (!exists) return candidate;
  }
  return `PO-${Date.now()}`;
}

export async function generateBatchNumber(date: Date) {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  for (let attempt = 0; attempt < 50; attempt++) {
    const count = await prisma.stockBatch.count({
      where: { batchNumber: { startsWith: `BATCH-${ymd}-` } },
    });
    const candidate = `BATCH-${ymd}-${String(count + 1 + attempt).padStart(3, "0")}`;
    const exists = await prisma.stockBatch.findUnique({ where: { batchNumber: candidate } });
    if (!exists) return candidate;
  }
  return `BATCH-${ymd}-${Date.now()}`;
}

export type LineTotalInput = { entryQuantity: number; unitCost: number };

export function computeTotal(lines: LineTotalInput[]) {
  return lines.reduce((sum, l) => sum + l.entryQuantity * l.unitCost, 0);
}

export function derivePaymentStatus(totalAmount: number, amountPaid: number): "UNPAID" | "PARTIAL" | "PAID" {
  if (amountPaid <= 0) return "UNPAID";
  if (amountPaid >= totalAmount - 0.005) return "PAID";
  return "PARTIAL";
}
