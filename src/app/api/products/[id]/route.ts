import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type PriceInput = { priceGroupId: string; currencyId: string; price: number };

function parsePrices(input: unknown): PriceInput[] | null {
  if (!Array.isArray(input)) return [];
  const parsed: PriceInput[] = [];
  for (const row of input) {
    const priceGroupId = row?.priceGroupId?.trim();
    const currencyId = row?.currencyId?.trim();
    const price = Number(row?.price);
    if (!priceGroupId || !currencyId || Number.isNaN(price) || price < 0) {
      return null;
    }
    parsed.push({ priceGroupId, currencyId, price });
  }
  const keys = new Set(parsed.map((p) => `${p.priceGroupId}:${p.currencyId}`));
  if (keys.size !== parsed.length) return null;
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

  const name = body.name?.trim();
  const mainCategoryId = body.mainCategoryId?.trim();
  const subCategoryId = body.subCategoryId?.trim() || null;
  const brandId = body.brandId?.trim() || null;
  const baseUnitId = body.baseUnitId?.trim();
  const codeMode = body.codeMode === "manual" ? "manual" : "auto";
  const code = body.code?.trim();
  const barcode = body.barcode?.trim();
  const barcodeMode = body.barcodeMode === "manual" ? "ORIGINAL" : "SYSTEM";
  const defaultPurchasePrice =
    body.defaultPurchasePrice === "" || body.defaultPurchasePrice == null
      ? null
      : Number(body.defaultPurchasePrice);
  const defaultSupplierId = body.defaultSupplierId?.trim() || null;
  const generalData =
    body.generalData && typeof body.generalData === "object" ? body.generalData : null;
  const isActive = body.isActive !== false;

  if (!name || !mainCategoryId || !baseUnitId || !code || !barcode) {
    return NextResponse.json(
      { error: "Name, main category, base unit, code, and barcode are required." },
      { status: 400 },
    );
  }
  if (defaultPurchasePrice != null && (Number.isNaN(defaultPurchasePrice) || defaultPurchasePrice < 0)) {
    return NextResponse.json(
      { error: "Default purchasing price must be a positive number." },
      { status: 400 },
    );
  }

  const prices = parsePrices(body.prices);
  if (prices === null) {
    return NextResponse.json(
      { error: "Each selling price needs a price group, currency, and a valid amount, with no duplicate price group/currency combinations." },
      { status: 400 },
    );
  }

  if (subCategoryId) {
    const subCategory = await prisma.subCategory.findUnique({ where: { id: subCategoryId } });
    if (!subCategory || subCategory.mainCategoryId !== mainCategoryId) {
      return NextResponse.json(
        { error: "Selected sub-category does not belong to the selected main category." },
        { status: 400 },
      );
    }
  }

  const duplicateCode = await prisma.product.findFirst({ where: { code, id: { not: id } } });
  if (duplicateCode) {
    return NextResponse.json({ error: "A product with this code already exists." }, { status: 409 });
  }
  const duplicateBarcode = await prisma.product.findFirst({ where: { barcode, id: { not: id } } });
  if (duplicateBarcode) {
    return NextResponse.json({ error: "A product with this barcode already exists." }, { status: 409 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.productPrice.deleteMany({ where: { productId: id } });
      return tx.product.update({
        where: { id },
        data: {
          name,
          mainCategoryId,
          subCategoryId,
          brandId,
          baseUnitId,
          code,
          codeIsAuto: codeMode === "auto",
          barcode,
          barcodeSource: barcodeMode,
          defaultPurchasePrice,
          defaultSupplierId,
          generalData,
          isActive,
          prices: {
            create: prices.map((p) => ({
              priceGroupId: p.priceGroupId,
              currencyId: p.currencyId,
              price: p.price,
            })),
          },
        },
        include: { prices: true },
      });
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Could not update product." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          purchaseLines: true,
          salesLines: true,
          stockMovements: true,
          contractLines: true,
        },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const linked =
    product._count.purchaseLines +
    product._count.salesLines +
    product._count.stockMovements +
    product._count.contractLines;

  if (linked > 0) {
    return NextResponse.json(
      { error: "Cannot delete: this product has purchase, sales, or stock history." },
      { status: 409 },
    );
  }

  await prisma.$transaction([
    prisma.productPrice.deleteMany({ where: { productId: id } }),
    prisma.product.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
