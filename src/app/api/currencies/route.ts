import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const currencies = await prisma.currency.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { prices: true } } },
  });
  return NextResponse.json(
    currencies.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      isDefault: c.isDefault,
      exchangeRate: c.exchangeRate,
      productPriceCount: c._count.prices,
    })),
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const code = body?.code?.trim().toUpperCase();
  const name = body?.name?.trim();
  const exchangeRate = Number(body?.exchangeRate ?? 1);
  const isDefault = Boolean(body?.isDefault);

  if (!code || !name) {
    return NextResponse.json(
      { error: "Code and name are required." },
      { status: 400 },
    );
  }
  if (!exchangeRate || exchangeRate <= 0) {
    return NextResponse.json(
      { error: "Exchange rate must be a positive number." },
      { status: 400 },
    );
  }

  const existing = await prisma.currency.findUnique({ where: { code } });
  if (existing) {
    return NextResponse.json(
      { error: "A currency with this code already exists." },
      { status: 409 },
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.currency.updateMany({
        data: { isDefault: false },
        where: { isDefault: true },
      });
    }
    return tx.currency.create({
      data: { code, name, exchangeRate, isDefault },
    });
  });

  return NextResponse.json(created, { status: 201 });
}
