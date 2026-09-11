import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type LineInput = {
  productId?: string;
  entryQuantity?: number;
  entryUnitId?: string;
  unitPrice?: number;
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

  const existing = await prisma.salesOrder.findUnique({ where: { id }, include: { lines: true } });
  if (!existing) {
    return NextResponse.json({ error: "Sales order not found." }, { status: 404 });
  }

  // Full edit is only allowed while still a draft: once completed, a sale is
  // permanent — same as a real receipt.
  if (existing.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Cannot edit a sale once it has been completed. Completed sales are permanent." },
      { status: 409 },
    );
  }

  const referenceMode = body.referenceMode === "manual" ? "manual" : "auto";
  const manualReference = body.reference?.trim() || "";
  const customerId = body.customerId?.trim() || null;
  const currencyId = body.currencyId?.trim();
  const warehouseId = body.warehouseId?.trim();
  const priceGroupId = body.priceGroupId?.trim() || null;
  const note = body.note?.trim() || null;
  const soldAt = body.soldAt ? new Date(body.soldAt) : existing.soldAt;

  if (!currencyId || !warehouseId) {
    return NextResponse.json({ error: "Currency and warehouse are required." }, { status: 400 });
  }
  if (referenceMode === "manual" && !manualReference) {
    return NextResponse.json(
      { error: "Enter a reference, or switch to auto-generate." },
      { status: 400 },
    );
  }
  if (Number.isNaN(soldAt.getTime())) {
    return NextResponse.json({ error: "Sale date is invalid." }, { status: 400 });
  }

  const lines = parseLines(body.lines);
  if (!lines) {
    return NextResponse.json({ error: "Add at least one sales line." }, { status: 400 });
  }

  const [currency, warehouse, customer, priceGroup] = await Promise.all([
    prisma.currency.findUnique({ where: { id: currencyId } }),
    prisma.warehouse.findUnique({ where: { id: warehouseId } }),
    customerId ? prisma.customer.findUnique({ where: { id: customerId } }) : Promise.resolve(null),
    priceGroupId ? prisma.priceGroup.findUnique({ where: { id: priceGroupId } }) : Promise.resolve(null),
  ]);
  if (!currency) return NextResponse.json({ error: "Selected currency does not exist." }, { status: 400 });
  if (!warehouse) return NextResponse.json({ error: "Selected warehouse does not exist." }, { status: 400 });
  if (customerId && !customer) return NextResponse.json({ error: "Selected customer does not exist." }, { status: 400 });
  if (priceGroupId && !priceGroup) return NextResponse.json({ error: "Selected price group does not exist." }, { status: 400 });

  const resolvedLines: {
    productId: string;
    entryQuantity: number;
    entryUnitId: string;
    quantity: number;
    unitPrice: number;
  }[] = [];

  for (const [index, line] of lines.entries()) {
    const productId = line.productId?.trim();
    const entryUnitId = line.entryUnitId?.trim();
    const entryQuantity = Number(line.entryQuantity);
    const unitPrice = Number(line.unitPrice);

    if (!productId || !entryUnitId) {
      return NextResponse.json({ error: `Line ${index + 1}: product and unit are required.` }, { status: 400 });
    }
    if (!entryQuantity || entryQuantity <= 0) {
      return NextResponse.json({ error: `Line ${index + 1}: quantity must be a positive number.` }, { status: 400 });
    }
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      return NextResponse.json({ error: `Line ${index + 1}: unit price must be a positive number.` }, { status: 400 });
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
    resolvedLines.push({ productId, entryQuantity, entryUnitId, quantity, unitPrice });
  }

  let reference = manualReference;
  if (referenceMode === "auto") {
    // Keep the reference already assigned to this order; auto-generation
    // only happens once, at creation time.
    reference = existing.reference;
  } else {
    const duplicate = await prisma.salesOrder.findFirst({ where: { reference, id: { not: id } } });
    if (duplicate) {
      return NextResponse.json({ error: "A sales order with this reference already exists." }, { status: 409 });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.salesOrderLine.deleteMany({ where: { salesOrderId: id } });
    return tx.salesOrder.update({
      where: { id },
      data: {
        reference,
        referenceIsAuto: referenceMode === "auto",
        customerId,
        currencyId,
        warehouseId,
        priceGroupId,
        note,
        soldAt,
        lines: {
          create: resolvedLines.map((l) => ({
            productId: l.productId,
            entryQuantity: l.entryQuantity,
            entryUnitId: l.entryUnitId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
        },
      },
    });
  });

  return NextResponse.json({ id: updated.id });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const existing = await prisma.salesOrder.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Sales order not found." }, { status: 404 });
  }

  if (existing.status === "COMPLETED") {
    return NextResponse.json(
      { error: "Cannot delete a sale that has already been completed. Completed sales are permanent." },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.salesOrderLine.deleteMany({ where: { salesOrderId: id } });
    await tx.salesOrder.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
