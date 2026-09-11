import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const duplicate = await prisma.currency.findFirst({
    where: { code, id: { not: id } },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "A currency with this code already exists." },
      { status: 409 },
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.currency.updateMany({
        data: { isDefault: false },
        where: { isDefault: true, id: { not: id } },
      });
    }
    return tx.currency
      .update({ where: { id }, data: { code, name, exchangeRate, isDefault } })
      .catch(() => null);
  });

  if (!updated) {
    return NextResponse.json(
      { error: "Currency not found." },
      { status: 404 },
    );
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const currency = await prisma.currency.findUnique({
    where: { id },
    include: { _count: { select: { prices: true, purchases: true, sales: true } } },
  });

  if (!currency) {
    return NextResponse.json(
      { error: "Currency not found." },
      { status: 404 },
    );
  }

  const linked =
    currency._count.prices + currency._count.purchases + currency._count.sales;
  if (linked > 0) {
    return NextResponse.json(
      { error: "Cannot delete: this currency is still in use." },
      { status: 409 },
    );
  }

  await prisma.currency.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
