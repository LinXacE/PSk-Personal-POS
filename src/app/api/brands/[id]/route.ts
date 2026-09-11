import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = body?.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const updated = await prisma.brand
    .update({ where: { id }, data: { name } })
    .catch(() => null);

  if (!updated) {
    return NextResponse.json({ error: "Brand not found." }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const brand = await prisma.brand.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });

  if (!brand) {
    return NextResponse.json({ error: "Brand not found." }, { status: 404 });
  }

  if (brand._count.products > 0) {
    return NextResponse.json(
      { error: "Cannot delete: this brand still has linked products." },
      { status: 409 },
    );
  }

  await prisma.brand.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
