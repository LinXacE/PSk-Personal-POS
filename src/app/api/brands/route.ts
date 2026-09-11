import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function codeFromName(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function GET() {
  const brands = await prisma.brand.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json(
    brands.map((b) => ({
      id: b.id,
      code: codeFromName(b.name),
      name: b.name,
      productCount: b._count.products,
    })),
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = body?.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const existing = await prisma.brand.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json(
      { error: "A brand with this name already exists." },
      { status: 409 },
    );
  }

  const created = await prisma.brand.create({ data: { name } });
  return NextResponse.json(created, { status: 201 });
}
