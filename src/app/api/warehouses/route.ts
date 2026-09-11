import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const warehouses = await prisma.warehouse.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { purchaseOrders: true, movements: true, batches: true } } },
  });
  return NextResponse.json(
    warehouses.map((w) => ({
      id: w.id,
      name: w.name,
      address: w.address,
      purchaseOrderCount: w._count.purchaseOrders,
      movementCount: w._count.movements,
      batchCount: w._count.batches,
    })),
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = body?.name?.trim();
  const address = body?.address?.trim() || null;

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const existing = await prisma.warehouse.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json(
      { error: "A warehouse with this name already exists." },
      { status: 409 },
    );
  }

  const created = await prisma.warehouse.create({
    data: { name, address },
  });
  return NextResponse.json(created, { status: 201 });
}
