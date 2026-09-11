import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const groups = await prisma.priceGroup.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { prices: true } } },
  });
  return NextResponse.json(
    groups.map((g) => ({
      id: g.id,
      name: g.name,
      isDefault: g.isDefault,
      productPriceCount: g._count.prices,
    })),
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = body?.name?.trim();
  const isDefault = Boolean(body?.isDefault);

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const existing = await prisma.priceGroup.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json(
      { error: "A price group with this name already exists." },
      { status: 409 },
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.priceGroup.updateMany({
        data: { isDefault: false },
        where: { isDefault: true },
      });
    }
    return tx.priceGroup.create({ data: { name, isDefault } });
  });

  return NextResponse.json(created, { status: 201 });
}
