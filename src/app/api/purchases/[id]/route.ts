import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeTotal, derivePaymentStatus } from "@/lib/purchase";

type LineInput = {
  productId?: string;
  entryQuantity?: number;
  entryUnitId?: string;
  unitCost?: number;
};

function parseLines(input: unknown): LineInput[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const parsed: LineInput[] = [];
  for (const row of input) {
    if (typeof row !== "object" || row === null) return null;
    parsed.push(row as LineInput);
  }
  return parsed;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const existing = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Purchase order not found." }, { status: 404 });
  }

  // Cancel: only safe while nothing has been received yet (no stock effect to undo).
  if (body.cancel) {
    if (existing.status !== "ORDERED") {
      return NextResponse.json(
        { error: "Only an order with nothing received yet can be cancelled." },
        { status: 409 },
      );
    }
    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    return NextResponse.json(updated);
  }

  // Payment-only update: allowed at any status, does not touch lines/supplier/etc.
  if (body.paymentOnly) {
    const amountPaid = Number(body.amountPaid);
    if (Number.isNaN(amountPaid) || amountPaid < 0) {
      return NextResponse.json({ error: "Amount paid must be a positive number." }, { status: 400 });
    }
    const totalAmount = computeTotal(existing.lines);
    const paymentStatus = derivePaymentStatus(totalAmount, amountPaid);
    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { amountPaid, paymentStatus },
    });
    return NextResponse.json(updated);
  }

  // Full edit: only allowed while the order hasn't started receiving stock.
  if (existing.status !== "ORDERED") {
    return NextResponse.json(
      { error: "Cannot edit a purchase order once receiving has started or it has been cancelled. Only payment can still be updated." },
      { status: 409 },
    );
  }

  const referenceMode = body.referenceMode === "manual" ? "manual" : "auto";
  const manualReference = body.reference?.trim() || "";
  const supplierId = body.supplierId?.trim();
  const currencyId = body.currencyId?.trim();
  const warehouseId = body.warehouseId?.trim();
  const note = body.note?.trim() || null;
  const amountPaid = body.amountPaid != null ? Number(body.amountPaid) : existing.amountPaid;
  const orderedAt = body.orderedAt ? new Date(body.orderedAt) : existing.orderedAt;

  if (!supplierId || !currencyId || !warehouseId) {
    return NextResponse.json(
      { error: "Supplier, currency, and warehouse are required." },
      { status: 400 },
    );
  }
  if (referenceMode === "manual" && !manualReference) {
    return NextResponse.json(
      { error: "Enter a reference, or switch to auto-generate." },
      { status: 400 },
    );
  }
  if (Number.isNaN(amountPaid) || amountPaid < 0) {
    return NextResponse.json({ error: "Amount paid must be a positive number." }, { status: 400 });
  }
  if (Number.isNaN(orderedAt.getTime())) {
    return NextResponse.json({ error: "Order date is invalid." }, { status: 400 });
  }

  const lines = parseLines(body.lines);
  if (!lines) {
    return NextResponse.json({ error: "Add at least one purchase line." }, { status: 400 });
  }

  const [supplier, currency, warehouse] = await Promise.all([
    prisma.supplier.findUnique({ where: { id: supplierId } }),
    prisma.currency.findUnique({ where: { id: currencyId } }),
    prisma.warehouse.findUnique({ where: { id: warehouseId } }),
  ]);
  if (!supplier) return NextResponse.json({ error: "Selected supplier does not exist." }, { status: 400 });
  if (!currency) return NextResponse.json({ error: "Selected currency does not exist." }, { status: 400 });
  if (!warehouse) return NextResponse.json({ error: "Selected warehouse does not exist." }, { status: 400 });

  const resolvedLines: {
    productId: string;
    entryQuantity: number;
    entryUnitId: string;
    quantity: number;
    unitCost: number;
    baseUnitCost: number;
  }[] = [];

  for (const [index, line] of lines.entries()) {
    const productId = line.productId?.trim();
    const entryUnitId = line.entryUnitId?.trim();
    const entryQuantity = Number(line.entryQuantity);
    const unitCost = Number(line.unitCost);

    if (!productId || !entryUnitId) {
      return NextResponse.json({ error: `Line ${index + 1}: product and unit are required.` }, { status: 400 });
    }
    if (!entryQuantity || entryQuantity <= 0) {
      return NextResponse.json({ error: `Line ${index + 1}: quantity must be a positive number.` }, { status: 400 });
    }
    if (Number.isNaN(unitCost) || unitCost < 0) {
      return NextResponse.json({ error: `Line ${index + 1}: unit cost must be a positive number.` }, { status: 400 });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: `Line ${index + 1}: selected product does not exist.` }, { status: 400 });
    }
    const entryUnit = await prisma.unit.findUnique({ where: { id: entryUnitId } });
    if (!entryUnit) {
      return NextResponse.json({ error: `Line ${index + 1}: selected unit does not exist.` }, { status: 400 });
    }
    const isBaseItself = entryUnit.id === product.baseUnitId;
    const isConversionOfBase = entryUnit.baseUnitId === product.baseUnitId;
    if (!isBaseItself && !isConversionOfBase) {
      return NextResponse.json(
        { error: `Line ${index + 1}: selected unit is not valid for this product's base unit.` },
        { status: 400 },
      );
    }

    const quantity = entryQuantity * entryUnit.conversionQty;
    const baseUnitCost = unitCost / entryUnit.conversionQty;
    resolvedLines.push({ productId, entryQuantity, entryUnitId, quantity, unitCost, baseUnitCost });
  }

  let reference = manualReference;
  if (referenceMode === "auto") {
    // Keep the reference already assigned to this order; auto-generation
    // only happens once, at creation time.
    reference = existing.reference;
  } else {
    const duplicate = await prisma.purchaseOrder.findFirst({ where: { reference, id: { not: id } } });
    if (duplicate) {
      return NextResponse.json({ error: "A purchase order with this reference already exists." }, { status: 409 });
    }
  }

  const totalAmount = computeTotal(resolvedLines);
  const paymentStatus = derivePaymentStatus(totalAmount, amountPaid);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: id } });
    const order = await tx.purchaseOrder.update({
      where: { id },
      data: {
        reference,
        referenceIsAuto: referenceMode === "auto",
        supplierId,
        currencyId,
        warehouseId,
        note,
        orderedAt,
        amountPaid,
        paymentStatus,
        lines: {
          create: resolvedLines.map((l) => ({
            productId: l.productId,
            entryQuantity: l.entryQuantity,
            entryUnitId: l.entryUnitId,
            quantity: l.quantity,
            unitCost: l.unitCost,
          })),
        },
      },
    });

    for (const l of resolvedLines) {
      await tx.product.update({
        where: { id: l.productId },
        data: { defaultPurchasePrice: l.baseUnitCost, defaultSupplierId: supplierId },
      });
    }

    return order;
  });

  return NextResponse.json({ id: updated.id });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Purchase order not found." }, { status: 404 });
  }

  if (existing.status === "RECEIVED" || existing.status === "PARTIALLY_RECEIVED") {
    return NextResponse.json(
      { error: "Cannot delete a purchase order that has already received stock. Cancel is not available either since stock has moved." },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: id } });
    await tx.purchaseOrder.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
