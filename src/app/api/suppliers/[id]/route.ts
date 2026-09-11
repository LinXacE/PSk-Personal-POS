import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = body?.name?.trim();
  const contact = body?.contact?.trim() || null;
  const address = body?.address?.trim() || null;

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const duplicate = await prisma.supplier.findFirst({
    where: { name, id: { not: id } },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "A supplier with this name already exists." },
      { status: 409 },
    );
  }

  const updated = await prisma.supplier
    .update({ where: { id }, data: { name, contact, address } })
    .catch(() => null);

  if (!updated) {
    return NextResponse.json(
      { error: "Supplier not found." },
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

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: { _count: { select: { purchases: true, defaultForProducts: true } } },
  });

  if (!supplier) {
    return NextResponse.json(
      { error: "Supplier not found." },
      { status: 404 },
    );
  }

  const linked = supplier._count.purchases + supplier._count.defaultForProducts;
  if (linked > 0) {
    return NextResponse.json(
      { error: "Cannot delete: this supplier is still linked to products or purchases." },
      { status: 409 },
    );
  }

  await prisma.supplier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
