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
  const subCategories = await prisma.subCategory.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      mainCategory: { select: { id: true, name: true, type: true } },
      _count: { select: { products: true } },
    },
  });

  return NextResponse.json(
    subCategories.map((s) => ({
      id: s.id,
      code: codeFromName(s.name),
      name: s.name,
      mainCategoryId: s.mainCategoryId,
      mainCategoryName: s.mainCategory.name,
      mainCategoryType: s.mainCategory.type,
      productCount: s._count.products,
    })),
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = body?.name?.trim();
  const mainCategoryId = body?.mainCategoryId?.trim();

  if (!name || !mainCategoryId) {
    return NextResponse.json(
      { error: "Name and main category are required." },
      { status: 400 },
    );
  }

  const mainCategory = await prisma.mainCategory.findUnique({
    where: { id: mainCategoryId },
  });
  if (!mainCategory) {
    return NextResponse.json(
      { error: "Selected main category does not exist." },
      { status: 400 },
    );
  }

  const existing = await prisma.subCategory.findUnique({
    where: { mainCategoryId_name: { mainCategoryId, name } },
  });
  if (existing) {
    return NextResponse.json(
      {
        error:
          "A sub-category with this name already exists under the selected main category.",
      },
      { status: 409 },
    );
  }

  const created = await prisma.subCategory.create({
    data: { name, mainCategoryId },
  });
  return NextResponse.json(created, { status: 201 });
}
