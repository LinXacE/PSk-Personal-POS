import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = body?.name?.trim();
  const mainCategoryId = body?.mainCategoryId?.trim();

  if (!name || !mainCategoryId) {
    return NextResponse.json(
      { error: "Name and main category are required." },
      { status: 400 },
    );
  }

  const duplicate = await prisma.subCategory.findFirst({
    where: { mainCategoryId, name, id: { not: id } },
  });
  if (duplicate) {
    return NextResponse.json(
      {
        error:
          "A sub-category with this name already exists under the selected main category.",
      },
      { status: 409 },
    );
  }

  const updated = await prisma.subCategory
    .update({ where: { id }, data: { name, mainCategoryId } })
    .catch(() => null);

  if (!updated) {
    return NextResponse.json(
      { error: "Sub-category not found." },
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

  const subCategory = await prisma.subCategory.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });

  if (!subCategory) {
    return NextResponse.json(
      { error: "Sub-category not found." },
      { status: 404 },
    );
  }

  if (subCategory._count.products > 0) {
    return NextResponse.json(
      {
        error: "Cannot delete: this sub-category still has linked products.",
      },
      { status: 409 },
    );
  }

  await prisma.subCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
