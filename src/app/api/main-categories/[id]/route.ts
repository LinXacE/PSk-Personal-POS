import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = body?.name?.trim();
  const type = body?.type === "SERVICE" ? "SERVICE" : "PRODUCT";

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const updated = await prisma.mainCategory
    .update({ where: { id }, data: { name, type } })
    .catch(() => null);

  if (!updated) {
    return NextResponse.json(
      { error: "Main category not found." },
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

  const category = await prisma.mainCategory.findUnique({
    where: { id },
    include: { _count: { select: { subCategories: true, products: true } } },
  });

  if (!category) {
    return NextResponse.json(
      { error: "Main category not found." },
      { status: 404 },
    );
  }

  if (category._count.subCategories > 0 || category._count.products > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete: this main category still has linked sub-categories or products.",
      },
      { status: 409 },
    );
  }

  await prisma.mainCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
