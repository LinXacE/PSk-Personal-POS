import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function codeFromName(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function generateProductCode(mainCategoryName: string, brandName?: string | null) {
  const prefixParts = [codeFromName(mainCategoryName)];
  if (brandName) prefixParts.push(codeFromName(brandName));
  const prefix = prefixParts.join("-");

  // Find the next free sequence number for this prefix.
  for (let attempt = 0; attempt < 50; attempt++) {
    const count = await prisma.product.count({
      where: { code: { startsWith: `${prefix}-` } },
    });
    const candidate = `${prefix}-${String(count + 1 + attempt).padStart(4, "0")}`;
    const exists = await prisma.product.findUnique({ where: { code: candidate } });
    if (!exists) return candidate;
  }
  // Extremely unlikely fallback.
  return `${prefix}-${Date.now()}`;
}

async function generateSystemBarcode() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = `SYS${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
    const exists = await prisma.product.findUnique({ where: { barcode: candidate } });
    if (!exists) return candidate;
    await new Promise((r) => setTimeout(r, 2));
  }
  throw new Error("Could not generate a unique barcode.");
}

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
  // No duplicate price-group + currency combos.
  const keys = new Set(parsed.map((p) => `${p.priceGroupId}:${p.currencyId}`));
  if (keys.size !== parsed.length) return null;
  return parsed;
}

export async function GET() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      mainCategory: { select: { id: true, name: true, type: true } },
      subCategory: { select: { id: true, name: true } },
      brand: { select: { id: true, name: true } },
      baseUnit: { select: { id: true, name: true } },
      defaultSupplier: { select: { id: true, name: true } },
      prices: {
        include: {
          priceGroup: { select: { id: true, name: true } },
          currency: { select: { id: true, code: true } },
        },
      },
    },
  });

  return NextResponse.json(
    products.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      codeIsAuto: p.codeIsAuto,
      type: p.type,
      mainCategoryId: p.mainCategoryId,
      mainCategoryName: p.mainCategory.name,
      subCategoryId: p.subCategoryId,
      subCategoryName: p.subCategory?.name ?? null,
      brandId: p.brandId,
      brandName: p.brand?.name ?? null,
      baseUnitId: p.baseUnitId,
      baseUnitName: p.baseUnit.name,
      barcode: p.barcode,
      barcodeSource: p.barcodeSource,
      defaultPurchasePrice: p.defaultPurchasePrice,
      defaultSupplierId: p.defaultSupplierId,
      defaultSupplierName: p.defaultSupplier?.name ?? null,
      generalData: p.generalData,
      isActive: p.isActive,
      prices: p.prices.map((price) => ({
        id: price.id,
        priceGroupId: price.priceGroupId,
        priceGroupName: price.priceGroup.name,
        currencyId: price.currencyId,
        currencyCode: price.currency.code,
        price: price.price,
      })),
    })),
  );
}

export async function POST(request: NextRequest) {
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
  const manualCode = body.code?.trim();
  const barcodeMode = body.barcodeMode === "manual" ? "manual" : "system";
  const manualBarcode = body.barcode?.trim();
  const defaultPurchasePrice =
    body.defaultPurchasePrice === "" || body.defaultPurchasePrice == null
      ? null
      : Number(body.defaultPurchasePrice);
  const defaultSupplierId = body.defaultSupplierId?.trim() || null;
  const generalData =
    body.generalData && typeof body.generalData === "object" ? body.generalData : null;

  if (!name || !mainCategoryId || !baseUnitId) {
    return NextResponse.json(
      { error: "Name, main category, and base unit are required." },
      { status: 400 },
    );
  }
  if (codeMode === "manual" && !manualCode) {
    return NextResponse.json(
      { error: "Enter a product code, or switch to auto-generate." },
      { status: 400 },
    );
  }
  if (barcodeMode === "manual" && !manualBarcode) {
    return NextResponse.json(
      { error: "Enter a barcode, or switch to system-generated." },
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

  const mainCategory = await prisma.mainCategory.findUnique({ where: { id: mainCategoryId } });
  if (!mainCategory) {
    return NextResponse.json({ error: "Selected main category does not exist." }, { status: 400 });
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

  const baseUnit = await prisma.unit.findUnique({ where: { id: baseUnitId } });
  if (!baseUnit || baseUnit.kind !== "BASE") {
    return NextResponse.json({ error: "Selected base unit is invalid." }, { status: 400 });
  }

  if (brandId) {
    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) {
      return NextResponse.json({ error: "Selected brand does not exist." }, { status: 400 });
    }
  }

  if (defaultSupplierId) {
    const supplier = await prisma.supplier.findUnique({ where: { id: defaultSupplierId } });
    if (!supplier) {
      return NextResponse.json({ error: "Selected supplier does not exist." }, { status: 400 });
    }
  }

  let code = manualCode;
  if (codeMode === "auto") {
    const brandName = brandId
      ? (await prisma.brand.findUnique({ where: { id: brandId } }))?.name
      : null;
    code = await generateProductCode(mainCategory.name, brandName);
  } else {
    const existingCode = await prisma.product.findUnique({ where: { code } });
    if (existingCode) {
      return NextResponse.json({ error: "A product with this code already exists." }, { status: 409 });
    }
  }

  let barcode = manualBarcode;
  if (barcodeMode === "system") {
    barcode = await generateSystemBarcode();
  } else {
    const existingBarcode = await prisma.product.findUnique({ where: { barcode } });
    if (existingBarcode) {
      return NextResponse.json({ error: "A product with this barcode already exists." }, { status: 409 });
    }
  }

  try {
    const created = await prisma.product.create({
      data: {
        name,
        code,
        codeIsAuto: codeMode === "auto",
        type: mainCategory.type,
        mainCategoryId,
        subCategoryId,
        brandId,
        baseUnitId,
        barcode,
        barcodeSource: barcodeMode === "system" ? "SYSTEM" : "ORIGINAL",
        defaultPurchasePrice,
        defaultSupplierId,
        generalData,
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
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not create product." }, { status: 500 });
  }
}
