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
  const mainCategories = await prisma.mainCategory.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { subCategories: true, products: true } } },
  });
  return NextResponse.json(
    mainCategories.map((c) => ({
      id: c.id,
      code: codeFromName(c.name),
      name: c.name,
      type: c.type,
      subCategoryCount: c._count.subCategories,
      productCount: c._count.products,
    })),
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = body?.name?.trim();
  const type = body?.type === "SERVICE" ? "SERVICE" : "PRODUCT";

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const existing = await prisma.mainCategory.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json(
      { error: "A main category with this name already exists." },
      { status: 409 },
    );
  }

  const created = await prisma.mainCategory.create({ data: { name, type } });
  return NextResponse.json(created, { status: 201 });
}
