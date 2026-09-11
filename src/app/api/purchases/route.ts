import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePurchaseReference, computeTotal, derivePaymentStatus } from "@/lib/purchase";

export async function GET() {
  const orders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      supplier: { select: { name: true } },
      currency: { select: { code: true } },
      warehouse: { select: { name: true } },
      lines: {
        include: {
          product: { select: { name: true, code: true, baseUnit: { select: { name: true } } } },
          entryUnit: { select: { name: true } },
          batches: true,
        },
      },
    },
  });

  return NextResponse.json(
    orders.map((o) => ({
      id: o.id,
      reference: o.reference,
      referenceIsAuto: o.referenceIsAuto,
      supplierId: o.supplierId,
      supplierName: o.supplier.name,
      currencyId: o.currencyId,
      currencyCode: o.currency.code,
      warehouseId: o.warehouseId,
      warehouseName: o.warehouse.name,
      status: o.status,
      paymentStatus: o.paymentStatus,
      amountPaid: o.amountPaid,
      totalAmount: computeTotal(o.lines),
      note: o.note,
      orderedAt: o.orderedAt,
      receivedAt: o.receivedAt,
      createdAt: o.createdAt,
      lines: o.lines.map((l) => ({
        id: l.id,
        productId: l.productId,
        productName: l.product.name,
        productCode: l.product.code,
        baseUnitName: l.product.baseUnit.name,
        entryQuantity: l.entryQuantity,
        entryUnitId: l.entryUnitId,
        entryUnitName: l.entryUnit.name,
        quantity: l.quantity,
        receivedQuantity: l.receivedQuantity,
        unitCost: l.unitCost,
        batches: l.batches.map((b) => ({
          id: b.id,
          batchNumber: b.batchNumber,
          quantityReceived: b.quantityReceived,
          quantityRemaining: b.quantityRemaining,
          unitCost: b.unitCost,
          receivedAt: b.receivedAt,
          expiryDate: b.expiryDate,
        })),
      })),
    })),
  );
}

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

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const referenceMode = body.referenceMode === "manual" ? "manual" : "auto";
  const manualReference = body.reference?.trim() || "";
  const supplierId = body.supplierId?.trim();
  const currencyId = body.currencyId?.trim();
  const warehouseId = body.warehouseId?.trim();
  const note = body.note?.trim() || null;
  const amountPaid = body.amountPaid != null ? Number(body.amountPaid) : 0;
  const orderedAt = body.orderedAt ? new Date(body.orderedAt) : new Date();

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
    return NextResponse.json(
      { error: "Add at least one purchase line." },
      { status: 400 },
    );
  }

  const [supplier, currency, warehouse] = await Promise.all([
    prisma.supplier.findUnique({ where: { id: supplierId } }),
    prisma.currency.findUnique({ where: { id: currencyId } }),
    prisma.warehouse.findUnique({ where: { id: warehouseId } }),
  ]);
  if (!supplier) return NextResponse.json({ error: "Selected supplier does not exist." }, { status: 400 });
  if (!currency) return NextResponse.json({ error: "Selected currency does not exist." }, { status: 400 });
  if (!warehouse) return NextResponse.json({ error: "Selected warehouse does not exist." }, { status: 400 });

  // Validate every line and compute base-unit quantity.
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
      return NextResponse.json(
        { error: `Line ${index + 1}: product and unit are required.` },
        { status: 400 },
      );
    }
    if (!entryQuantity || entryQuantity <= 0) {
      return NextResponse.json(
        { error: `Line ${index + 1}: quantity must be a positive number.` },
        { status: 400 },
      );
    }
    if (Number.isNaN(unitCost) || unitCost < 0) {
      return NextResponse.json(
        { error: `Line ${index + 1}: unit cost must be a positive number.` },
        { status: 400 },
      );
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json(
        { error: `Line ${index + 1}: selected product does not exist.` },
        { status: 400 },
      );
    }
    const entryUnit = await prisma.unit.findUnique({ where: { id: entryUnitId } });
    if (!entryUnit) {
      return NextResponse.json(
        { error: `Line ${index + 1}: selected unit does not exist.` },
        { status: 400 },
      );
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
    reference = await generatePurchaseReference();
  } else {
    const existingReference = await prisma.purchaseOrder.findUnique({ where: { reference } });
    if (existingReference) {
      return NextResponse.json({ error: "A purchase order with this reference already exists." }, { status: 409 });
    }
  }

  const totalAmount = computeTotal(resolvedLines);
  const paymentStatus = derivePaymentStatus(totalAmount, amountPaid);

  const created = await prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.create({
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

    // Keep each product's latest quoted purchasing price + preferred supplier
    // up to date as soon as a Purchase Order records that price (regardless
    // of whether the goods have physically arrived yet).
    for (const l of resolvedLines) {
      await tx.product.update({
        where: { id: l.productId },
        data: { defaultPurchasePrice: l.baseUnitCost, defaultSupplierId: supplierId },
      });
    }

    return order;
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
