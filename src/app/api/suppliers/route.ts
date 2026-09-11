import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { purchases: true, defaultForProducts: true } } },
  });
  return NextResponse.json(
    suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      contact: s.contact,
      address: s.address,
      purchaseCount: s._count.purchases,
      productCount: s._count.defaultForProducts,
    })),
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = body?.name?.trim();
  const contact = body?.contact?.trim() || null;
  const address = body?.address?.trim() || null;

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const existing = await prisma.supplier.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json(
      { error: "A supplier with this name already exists." },
      { status: 409 },
    );
  }

  const created = await prisma.supplier.create({
    data: { name, contact, address },
  });
  return NextResponse.json(created, { status: 201 });
}
