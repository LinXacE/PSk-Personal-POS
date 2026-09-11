import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const units = await prisma.unit.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      baseUnit: { select: { name: true } },
      _count: { select: { products: true, derivedUnits: true } },
    },
  });

  return NextResponse.json(
    units.map((u) => ({
      id: u.id,
      name: u.name,
      kind: u.kind,
      baseUnitId: u.baseUnitId,
      baseUnitName: u.baseUnit?.name ?? null,
      conversionQty: u.conversionQty,
      productCount: u._count.products,
      derivedUnitCount: u._count.derivedUnits,
    })),
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = body?.name?.trim();
  const kind = body?.kind === "PURCHASE" || body?.kind === "SELLING" ? body.kind : "BASE";
  const baseUnitId = body?.baseUnitId?.trim() || null;
  const conversionQty = kind === "BASE" ? 1 : Number(body?.conversionQty);

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const existing = await prisma.unit.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json(
      { error: "A unit with this name already exists." },
      { status: 409 },
    );
  }

  if (kind !== "BASE") {
    if (!baseUnitId) {
      return NextResponse.json(
        { error: "A base unit is required for purchase/selling units." },
        { status: 400 },
      );
    }
    if (!conversionQty || conversionQty <= 0) {
      return NextResponse.json(
        { error: "Conversion quantity must be a positive number." },
        { status: 400 },
      );
    }
    const base = await prisma.unit.findUnique({ where: { id: baseUnitId } });
    if (!base || base.kind !== "BASE") {
      return NextResponse.json(
        { error: "Selected base unit is invalid." },
        { status: 400 },
      );
    }
  }

  const created = await prisma.unit.create({
    data: {
      name,
      kind,
      baseUnitId: kind === "BASE" ? null : baseUnitId,
      conversionQty: kind === "BASE" ? 1 : conversionQty,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
