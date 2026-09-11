import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { planFefoAllocation, EPSILON } from "@/lib/sales";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: { lines: { include: { product: { select: { name: true } } } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Sales order not found." }, { status: 404 });
  }
  if (order.status !== "DRAFT") {
    return NextResponse.json({ error: "This sale has already been completed." }, { status: 409 });
  }
  if (order.lines.length === 0) {
    return NextResponse.json({ error: "Cannot complete a sale with no lines." }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // All-or-nothing: check every line's availability before deducting
      // anything, so a shortfall on one line rolls back the whole checkout.
      const plans: { lineId: string; productId: string; productName: string; allocations: { batchId: string; quantity: number; unitCost: number }[] }[] = [];

      for (const line of order.lines) {
        const batches = await tx.stockBatch.findMany({
          where: { productId: line.productId, warehouseId: order.warehouseId, quantityRemaining: { gt: EPSILON } },
          select: { id: true, quantityRemaining: true, unitCost: true, expiryDate: true, receivedAt: true },
        });

        const plan = planFefoAllocation(batches, line.quantity);
        if (!plan.ok) {
          throw new Error(
            `Not enough stock for "${line.product.name}": requested ${line.quantity}, only ${plan.available} available in this warehouse.`,
          );
        }
        plans.push({ lineId: line.id, productId: line.productId, productName: line.product.name, allocations: plan.allocations });
      }

      for (const plan of plans) {
        for (const alloc of plan.allocations) {
          await tx.stockBatch.update({
            where: { id: alloc.batchId },
            data: { quantityRemaining: { decrement: alloc.quantity } },
          });

          await tx.stockMovement.create({
            data: {
              productId: plan.productId,
              warehouseId: order.warehouseId,
              type: "SALE",
              quantity: -alloc.quantity,
              batchId: alloc.batchId,
              reference: order.reference,
              createdAt: new Date(),
            },
          });

          await tx.salesOrderLineBatch.create({
            data: {
              salesOrderLineId: plan.lineId,
              batchId: alloc.batchId,
              quantity: alloc.quantity,
              unitCost: alloc.unitCost,
            },
          });
        }
      }

      await tx.salesOrder.update({
        where: { id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not complete this sale.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
