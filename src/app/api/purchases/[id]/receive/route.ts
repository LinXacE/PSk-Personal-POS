import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateBatchNumber } from "@/lib/purchase";

type ReceiveLineInput = {
  lineId?: string;
  receiveEntryQuantity?: number;
  batchMode?: "auto" | "manual";
  batchNumber?: string;
  expiryDate?: string | null;
};

const EPSILON = 1e-6;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { lines: { include: { entryUnit: true } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Purchase order not found." }, { status: 404 });
  }
  if (order.status === "CANCELLED") {
    return NextResponse.json({ error: "This purchase order was cancelled." }, { status: 409 });
  }
  if (order.status === "RECEIVED") {
    return NextResponse.json({ error: "This purchase order has already been fully received." }, { status: 409 });
  }

  const rawLines: ReceiveLineInput[] = Array.isArray(body.lines) ? body.lines : [];
  const receivable = rawLines.filter(
    (l) => l.receiveEntryQuantity != null && Number(l.receiveEntryQuantity) > 0,
  );
  if (receivable.length === 0) {
    return NextResponse.json(
      { error: "Enter a received quantity for at least one line." },
      { status: 400 },
    );
  }

  const note = body.note?.trim() || null;
  const receivedAt = body.receivedAt ? new Date(body.receivedAt) : new Date();
  if (Number.isNaN(receivedAt.getTime())) {
    return NextResponse.json({ error: "Received date is invalid." }, { status: 400 });
  }

  // Validate every requested line up front.
  const plans: {
    line: (typeof order.lines)[number];
    receiveBaseQty: number;
    receiveEntryQty: number;
    batchMode: "auto" | "manual";
    batchNumber: string | null;
    expiryDate: Date | null;
  }[] = [];

  for (const req of receivable) {
    const line = order.lines.find((l) => l.id === req.lineId);
    if (!line) {
      return NextResponse.json(
        { error: `Line ${req.lineId ?? "?"} does not belong to this purchase order.` },
        { status: 400 },
      );
    }
    const receiveEntryQty = Number(req.receiveEntryQuantity);
    const receiveBaseQty = receiveEntryQty * line.entryUnit.conversionQty;
    const remainingBase = line.quantity - line.receivedQuantity;
    if (receiveBaseQty > remainingBase + EPSILON) {
      return NextResponse.json(
        {
          error: `Line for this product: cannot receive more than the remaining ${(remainingBase / line.entryUnit.conversionQty).toFixed(2)} ${line.entryUnit.name} left to receive.`,
        },
        { status: 400 },
      );
    }

    const batchMode = req.batchMode === "manual" ? "manual" : "auto";
    let batchNumber: string | null = null;
    if (batchMode === "manual") {
      batchNumber = req.batchNumber?.trim() || null;
      if (!batchNumber) {
        return NextResponse.json(
          { error: "Enter a batch number, or switch to auto-generate." },
          { status: 400 },
        );
      }
      const existingBatch = await prisma.stockBatch.findUnique({ where: { batchNumber } });
      if (existingBatch) {
        return NextResponse.json(
          { error: `Batch number "${batchNumber}" is already in use.` },
          { status: 409 },
        );
      }
    }

    let expiryDate: Date | null = null;
    if (req.expiryDate) {
      expiryDate = new Date(req.expiryDate);
      if (Number.isNaN(expiryDate.getTime())) {
        return NextResponse.json({ error: "Expiry date is invalid." }, { status: 400 });
      }
    }

    plans.push({ line, receiveBaseQty, receiveEntryQty, batchMode, batchNumber, expiryDate });
  }

  await prisma.$transaction(async (tx) => {
    for (const plan of plans) {
      const batchNumber = plan.batchMode === "auto" ? await generateBatchNumber(receivedAt) : plan.batchNumber!;
      const baseUnitCost = plan.line.unitCost / plan.line.entryUnit.conversionQty;

      const batch = await tx.stockBatch.create({
        data: {
          batchNumber,
          productId: plan.line.productId,
          warehouseId: order.warehouseId,
          purchaseOrderLineId: plan.line.id,
          quantityReceived: plan.receiveBaseQty,
          quantityRemaining: plan.receiveBaseQty,
          unitCost: baseUnitCost,
          receivedAt,
          expiryDate: plan.expiryDate,
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: plan.line.productId,
          warehouseId: order.warehouseId,
          type: "PURCHASE",
          quantity: plan.receiveBaseQty,
          entryQuantity: plan.receiveEntryQty,
          entryUnitId: plan.line.entryUnitId,
          batchId: batch.id,
          reference: order.reference,
          note,
          createdAt: receivedAt,
        },
      });

      await tx.purchaseOrderLine.update({
        where: { id: plan.line.id },
        data: { receivedQuantity: { increment: plan.receiveBaseQty } },
      });
    }

    const freshLines = await tx.purchaseOrderLine.findMany({ where: { purchaseOrderId: id } });
    const allReceived = freshLines.every((l) => l.receivedQuantity >= l.quantity - EPSILON);
    const anyReceived = freshLines.some((l) => l.receivedQuantity > EPSILON);

    await tx.purchaseOrder.update({
      where: { id },
      data: {
        status: allReceived ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : "ORDERED",
        receivedAt: allReceived ? receivedAt : order.receivedAt,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
