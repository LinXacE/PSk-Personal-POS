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
