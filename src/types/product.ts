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
