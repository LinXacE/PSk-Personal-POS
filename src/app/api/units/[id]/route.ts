import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = body?.name?.trim();
  const kind = body?.kind === "PURCHASE" || body?.kind === "SELLING" ? body.kind : "BASE";
  const baseUnitId = body?.baseUnitId?.trim() || null;
  const conversionQty = kind === "BASE" ? 1 : Number(body?.conversionQty);

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  if (kind !== "BASE") {
    if (!baseUnitId) {
      return NextResponse.json(
        { error: "A base unit is required for purchase/selling units." },
        { status: 400 },
      );
    }
    if (baseUnitId === id) {
      return NextResponse.json(
        { error: "A unit cannot be its own base unit." },
        { status: 400 },
      );
    }
    if (!conversionQty || conversionQty <= 0) {
      return NextResponse.json(
        { error: "Conversion quantity must be a positive number." },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.unit
    .update({
      where: { id },
      data: {
        name,
        kind,
        baseUnitId: kind === "BASE" ? null : baseUnitId,
        conversionQty: kind === "BASE" ? 1 : conversionQty,
      },
    })
    .catch(() => null);

  if (!updated) {
    return NextResponse.json({ error: "Unit not found." }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const unit = await prisma.unit.findUnique({
    where: { id },
    include: { _count: { select: { products: true, derivedUnits: true } } },
  });

  if (!unit) {
    return NextResponse.json({ error: "Unit not found." }, { status: 404 });
  }

  if (unit._count.products > 0 || unit._count.derivedUnits > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete: this unit is still linked to products or other units.",
      },
      { status: 409 },
    );
  }

  await prisma.unit.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
