import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSalesReference, computeSalesTotal } from "@/lib/sales";

export async function GET() {
  const orders = await prisma.salesOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true } },
      currency: { select: { code: true } },
      warehouse: { select: { name: true } },
      priceGroup: { select: { name: true } },
      lines: {
        include: {
          product: { select: { name: true, code: true, baseUnit: { select: { name: true } } } },
          entryUnit: { select: { name: true } },
          allocations: { include: { batch: { select: { batchNumber: true } } } },
        },
      },
    },
  });

  return NextResponse.json(
    orders.map((o) => ({
      id: o.id,
      reference: o.reference,
      referenceIsAuto: o.referenceIsAuto,
      customerId: o.customerId,
      customerName: o.customer?.name ?? null,
      currencyId: o.currencyId,
      currencyCode: o.currency.code,
      warehouseId: o.warehouseId,
      warehouseName: o.warehouse.name,
      priceGroupId: o.priceGroupId,
      priceGroupName: o.priceGroup?.name ?? null,
      status: o.status,
      totalAmount: computeSalesTotal(o.lines),
      note: o.note,
      soldAt: o.soldAt,
      completedAt: o.completedAt,
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
        unitPrice: l.unitPrice,
        allocations: l.allocations.map((a) => ({
          batchNumber: a.batch.batchNumber,
          quantity: a.quantity,
          unitCost: a.unitCost,
        })),
      })),
    })),
  );
}

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

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const referenceMode = body.referenceMode === "manual" ? "manual" : "auto";
  const manualReference = body.reference?.trim() || "";
  const customerId = body.customerId?.trim() || null;
  const currencyId = body.currencyId?.trim();
  const warehouseId = body.warehouseId?.trim();
  const priceGroupId = body.priceGroupId?.trim() || null;
  const note = body.note?.trim() || null;
  const soldAt = body.soldAt ? new Date(body.soldAt) : new Date();

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
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      return NextResponse.json(
        { error: `Line ${index + 1}: unit price must be a positive number.` },
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
    resolvedLines.push({ productId, entryQuantity, entryUnitId, quantity, unitPrice });
  }

  let reference = manualReference;
  if (referenceMode === "auto") {
    reference = await generateSalesReference();
  } else {
    const existingReference = await prisma.salesOrder.findUnique({ where: { reference } });
    if (existingReference) {
      return NextResponse.json({ error: "A sales order with this reference already exists." }, { status: 409 });
    }
  }

  const created = await prisma.salesOrder.create({
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

  return NextResponse.json({ id: created.id }, { status: 201 });
}
