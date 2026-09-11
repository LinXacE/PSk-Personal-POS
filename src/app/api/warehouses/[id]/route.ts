import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = body?.name?.trim();
  const address = body?.address?.trim() || null;

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const duplicate = await prisma.warehouse.findFirst({
    where: { name, id: { not: id } },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "A warehouse with this name already exists." },
      { status: 409 },
    );
  }

  const updated = await prisma.warehouse
    .update({ where: { id }, data: { name, address } })
    .catch(() => null);

  if (!updated) {
    return NextResponse.json(
      { error: "Warehouse not found." },
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

  const warehouse = await prisma.warehouse.findUnique({
    where: { id },
    include: { _count: { select: { purchaseOrders: true, movements: true, batches: true } } },
  });

  if (!warehouse) {
    return NextResponse.json(
      { error: "Warehouse not found." },
      { status: 404 },
    );
  }

  const linked =
    warehouse._count.purchaseOrders + warehouse._count.movements + warehouse._count.batches;
  if (linked > 0) {
    return NextResponse.json(
      { error: "Cannot delete: this warehouse is still linked to purchase orders or stock." },
      { status: 409 },
    );
  }

  await prisma.warehouse.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
