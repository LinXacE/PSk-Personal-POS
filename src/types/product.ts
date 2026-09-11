export type CategoryType = "PRODUCT" | "SERVICE";

export type MainCategoryDTO = {
  id: string;
  code: string;
  name: string;
  type: CategoryType;
  subCategoryCount: number;
  productCount: number;
};

export type BrandDTO = {
  id: string;
  code: string;
  name: string;
  productCount: number;
};

export type SubCategoryDTO = {
  id: string;
  code: string;
  name: string;
  mainCategoryId: string;
  mainCategoryName: string;
  mainCategoryType: CategoryType;
  productCount: number;
};

export type UnitKind = "BASE" | "PURCHASE" | "SELLING";

export type UnitDTO = {
  id: string;
  name: string;
  kind: UnitKind;
  baseUnitId: string | null;
  baseUnitName: string | null;
  conversionQty: number;
  productCount: number;
  derivedUnitCount: number;
};

export type BarcodeSource = "ORIGINAL" | "SYSTEM";

export type ProductPriceDTO = {
  id?: string;
  priceGroupId: string;
  priceGroupName?: string;
  currencyId: string;
  currencyCode?: string;
  price: number;
};

export type ProductDTO = {
  id: string;
  name: string;
  code: string;
  codeIsAuto: boolean;
  type: CategoryType;
  mainCategoryId: string;
  mainCategoryName: string;
  subCategoryId: string | null;
  subCategoryName: string | null;
  brandId: string | null;
  brandName: string | null;
  baseUnitId: string;
  baseUnitName: string;
  barcode: string;
  barcodeSource: BarcodeSource;
  defaultPurchasePrice: number | null;
  defaultSupplierId: string | null;
  defaultSupplierName: string | null;
  generalData: Record<string, string> | null;
  isActive: boolean;
  prices: ProductPriceDTO[];
};
