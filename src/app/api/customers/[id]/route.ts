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

  const updated = await prisma.customer
    .update({ where: { id }, data: { name, contact, address } })
    .catch(() => null);

  if (!updated) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { _count: { select: { sales: true, contracts: true, serviceTickets: true } } },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  const linked =
    customer._count.sales + customer._count.contracts + customer._count.serviceTickets;
  if (linked > 0) {
    return NextResponse.json(
      { error: "Cannot delete: this customer is still linked to sales, contracts, or service tickets." },
      { status: 409 },
    );
  }

  await prisma.customer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
