import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { sales: true, contracts: true, serviceTickets: true } } },
  });
  return NextResponse.json(
    customers.map((c) => ({
      id: c.id,
      name: c.name,
      contact: c.contact,
      address: c.address,
      salesCount: c._count.sales,
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

  const created = await prisma.customer.create({
    data: { name, contact, address },
  });
  return NextResponse.json(created, { status: 201 });
}
