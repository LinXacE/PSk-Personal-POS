export type CurrencyDTO = {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  exchangeRate: number;
  productPriceCount: number;
};

export type PriceGroupDTO = {
  id: string;
  name: string;
  isDefault: boolean;
  productPriceCount: number;
};

export type SupplierDTO = {
  id: string;
  name: string;
  contact: string | null;
  address: string | null;
  purchaseCount: number;
  productCount: number;
};
