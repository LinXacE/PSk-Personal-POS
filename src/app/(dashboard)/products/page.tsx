import { prisma } from "@/lib/prisma";
import { ProductClient } from "./product-client";
import type {
  BrandDTO,
  MainCategoryDTO,
  ProductDTO,
  SubCategoryDTO,
  UnitDTO,
} from "@/types/product";
import type { CurrencyDTO, PriceGroupDTO, SupplierDTO } from "@/types/settings";

export default async function ProductsPage() {
  const [
    products,
    mainCategoryRows,
    subCategoryRows,
    brandRows,
    unitRows,
    currencyRows,
    priceGroupRows,
    supplierRows,
  ] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        mainCategory: { select: { id: true, name: true, type: true } },
        subCategory: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        baseUnit: { select: { id: true, name: true } },
        defaultSupplier: { select: { id: true, name: true } },
        prices: {
          include: {
            priceGroup: { select: { id: true, name: true } },
            currency: { select: { id: true, code: true } },
          },
        },
      },
    }),
    prisma.mainCategory.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { subCategories: true, products: true } } },
    }),
    prisma.subCategory.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        mainCategory: { select: { name: true, type: true } },
        _count: { select: { products: true } },
      },
    }),
    prisma.brand.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { products: true } } },
    }),
    prisma.unit.findMany({
      where: { kind: "BASE" },
      orderBy: { createdAt: "asc" },
      include: {
        baseUnit: { select: { id: true, name: true } },
        _count: { select: { products: true, derivedUnits: true } },
      },
    }),
    prisma.currency.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { prices: true } } },
    }),
    prisma.priceGroup.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { prices: true } } },
    }),
    prisma.supplier.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { purchases: true, defaultForProducts: true } } },
    }),
  ]);

  function codeFromName(name: string) {
    return name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  const productDTOs: ProductDTO[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    codeIsAuto: p.codeIsAuto,
    type: p.type,
    mainCategoryId: p.mainCategoryId,
    mainCategoryName: p.mainCategory.name,
    subCategoryId: p.subCategoryId,
    subCategoryName: p.subCategory?.name ?? null,
    brandId: p.brandId,
    brandName: p.brand?.name ?? null,
    baseUnitId: p.baseUnitId,
    baseUnitName: p.baseUnit.name,
    barcode: p.barcode,
    barcodeSource: p.barcodeSource,
    defaultPurchasePrice: p.defaultPurchasePrice,
    defaultSupplierId: p.defaultSupplierId,
    defaultSupplierName: p.defaultSupplier?.name ?? null,
    generalData: (p.generalData as Record<string, string> | null) ?? null,
    isActive: p.isActive,
    prices: p.prices.map((price) => ({
      id: price.id,
      priceGroupId: price.priceGroupId,
      priceGroupName: price.priceGroup.name,
      currencyId: price.currencyId,
      currencyCode: price.currency.code,
      price: price.price,
    })),
  }));

  const mainCategories: MainCategoryDTO[] = mainCategoryRows.map((c) => ({
    id: c.id,
    code: codeFromName(c.name),
    name: c.name,
    type: c.type,
    subCategoryCount: c._count.subCategories,
    productCount: c._count.products,
  }));

  const subCategories: SubCategoryDTO[] = subCategoryRows.map((s) => ({
    id: s.id,
    code: codeFromName(s.name),
    name: s.name,
    mainCategoryId: s.mainCategoryId,
    mainCategoryName: s.mainCategory.name,
    mainCategoryType: s.mainCategory.type,
    productCount: s._count.products,
  }));

  const brands: BrandDTO[] = brandRows.map((b) => ({
    id: b.id,
    code: codeFromName(b.name),
    name: b.name,
    productCount: b._count.products,
  }));

  const baseUnits: UnitDTO[] = unitRows.map((u) => ({
    id: u.id,
    name: u.name,
    kind: u.kind,
    baseUnitId: u.baseUnitId,
    baseUnitName: u.baseUnit?.name ?? null,
    conversionQty: u.conversionQty,
    productCount: u._count.products,
    derivedUnitCount: u._count.derivedUnits,
  }));

  const currencies: CurrencyDTO[] = currencyRows.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    isDefault: c.isDefault,
    exchangeRate: c.exchangeRate,
    productPriceCount: c._count.prices,
  }));

  const priceGroups: PriceGroupDTO[] = priceGroupRows.map((g) => ({
    id: g.id,
    name: g.name,
    isDefault: g.isDefault,
    productPriceCount: g._count.prices,
  }));

  const suppliers: SupplierDTO[] = supplierRows.map((s) => ({
    id: s.id,
    name: s.name,
    contact: s.contact,
    address: s.address,
    purchaseCount: s._count.purchases,
    productCount: s._count.defaultForProducts,
  }));

  return (
    <ProductClient
      products={productDTOs}
      mainCategories={mainCategories}
      subCategories={subCategories}
      brands={brands}
      baseUnits={baseUnits}
      currencies={currencies}
      priceGroups={priceGroups}
      suppliers={suppliers}
    />
  );
}
