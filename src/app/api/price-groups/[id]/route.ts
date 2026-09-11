import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = body?.name?.trim();
  const isDefault = Boolean(body?.isDefault);

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const duplicate = await prisma.priceGroup.findFirst({
    where: { name, id: { not: id } },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "A price group with this name already exists." },
      { status: 409 },
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.priceGroup.updateMany({
        data: { isDefault: false },
        where: { isDefault: true, id: { not: id } },
      });
    }
    return tx.priceGroup
      .update({ where: { id }, data: { name, isDefault } })
      .catch(() => null);
  });

  if (!updated) {
    return NextResponse.json(
      { error: "Price group not found." },
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

  const group = await prisma.priceGroup.findUnique({
    where: { id },
    include: { _count: { select: { prices: true } } },
  });

  if (!group) {
    return NextResponse.json(
      { error: "Price group not found." },
      { status: 404 },
    );
  }

  if (group._count.prices > 0) {
    return NextResponse.json(
      {
        error: "Cannot delete: this price group still has linked product prices.",
      },
      { status: 409 },
    );
  }

  await prisma.priceGroup.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
