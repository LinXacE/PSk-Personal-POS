"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type {
  BrandDTO,
  MainCategoryDTO,
  ProductDTO,
  SubCategoryDTO,
  UnitDTO,
} from "@/types/product";
import type { CurrencyDTO, PriceGroupDTO, SupplierDTO } from "@/types/settings";

type ProductClientProps = {
  products: ProductDTO[];
  mainCategories: MainCategoryDTO[];
  subCategories: SubCategoryDTO[];
  brands: BrandDTO[];
  baseUnits: UnitDTO[];
  currencies: CurrencyDTO[];
  priceGroups: PriceGroupDTO[];
  suppliers: SupplierDTO[];
};

type PriceRow = { priceGroupId: string; currencyId: string; price: string };
type GeneralDataRow = { key: string; value: string };

type FormState = {
  name: string;
  mainCategoryId: string;
  subCategoryId: string;
  brandId: string;
  baseUnitId: string;
  codeMode: "auto" | "manual";
  code: string;
  barcodeMode: "system" | "manual";
  barcode: string;
  defaultPurchasePrice: string;
  defaultSupplierId: string;
  prices: PriceRow[];
  generalData: GeneralDataRow[];
};

type PanelState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; product: ProductDTO };

function emptyForm(mainCategories: MainCategoryDTO[], baseUnits: UnitDTO[]): FormState {
  return {
    name: "",
    mainCategoryId: mainCategories[0]?.id ?? "",
    subCategoryId: "",
    brandId: "",
    baseUnitId: baseUnits[0]?.id ?? "",
    codeMode: "auto",
    code: "",
    barcodeMode: "system",
    barcode: "",
    defaultPurchasePrice: "",
    defaultSupplierId: "",
    prices: [],
    generalData: [],
  };
}

function formFromProduct(product: ProductDTO): FormState {
  return {
    name: product.name,
    mainCategoryId: product.mainCategoryId,
    subCategoryId: product.subCategoryId ?? "",
    brandId: product.brandId ?? "",
    baseUnitId: product.baseUnitId,
    codeMode: product.codeIsAuto ? "auto" : "manual",
    code: product.code,
    barcodeMode: product.barcodeSource === "ORIGINAL" ? "manual" : "system",
    barcode: product.barcode,
    defaultPurchasePrice:
      product.defaultPurchasePrice != null ? String(product.defaultPurchasePrice) : "",
    defaultSupplierId: product.defaultSupplierId ?? "",
    prices: product.prices.map((p) => ({
      priceGroupId: p.priceGroupId,
      currencyId: p.currencyId,
      price: String(p.price),
    })),
    generalData: product.generalData
      ? Object.entries(product.generalData).map(([key, value]) => ({ key, value: String(value) }))
      : [],
  };
}

export function ProductClient({
  products,
  mainCategories,
  subCategories,
  brands,
  baseUnits,
  currencies,
  priceGroups,
  suppliers,
}: ProductClientProps) {
  const router = useRouter();
  const [panel, setPanel] = useState<PanelState>({ mode: "closed" });
  const [form, setForm] = useState<FormState>(emptyForm(mainCategories, baseUnits));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterMainCategoryId, setFilterMainCategoryId] = useState("all");

  const filteredSubCategories = useMemo(
    () => subCategories.filter((s) => s.mainCategoryId === form.mainCategoryId),
    [subCategories, form.mainCategoryId],
  );

  const filteredProducts =
    filterMainCategoryId === "all"
      ? products
      : products.filter((p) => p.mainCategoryId === filterMainCategoryId);

  const missingPrerequisites =
    mainCategories.length === 0 || baseUnits.length === 0 || currencies.length === 0 || priceGroups.length === 0;

  function openCreate() {
    setForm(emptyForm(mainCategories, baseUnits));
    setError("");
    setPanel({ mode: "create" });
  }

  function openEdit(product: ProductDTO) {
    setForm(formFromProduct(product));
    setError("");
    setPanel({ mode: "edit", product });
  }

  function closePanel() {
    setPanel({ mode: "closed" });
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleMainCategoryChange(mainCategoryId: string) {
    setForm((prev) => ({ ...prev, mainCategoryId, subCategoryId: "" }));
  }

  function addPriceRow() {
    setForm((prev) => ({
      ...prev,
      prices: [
        ...prev.prices,
        {
          priceGroupId: priceGroups[0]?.id ?? "",
          currencyId: currencies.find((c) => c.isDefault)?.id ?? currencies[0]?.id ?? "",
          price: "",
        },
      ],
    }));
  }

  function updatePriceRow(index: number, patch: Partial<PriceRow>) {
    setForm((prev) => ({
      ...prev,
      prices: prev.prices.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }

  function removePriceRow(index: number) {
    setForm((prev) => ({ ...prev, prices: prev.prices.filter((_, i) => i !== index) }));
  }

  function addGeneralDataRow() {
    setForm((prev) => ({ ...prev, generalData: [...prev.generalData, { key: "", value: "" }] }));
  }

  function updateGeneralDataRow(index: number, patch: Partial<GeneralDataRow>) {
    setForm((prev) => ({
      ...prev,
      generalData: prev.generalData.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }

  function removeGeneralDataRow(index: number) {
    setForm((prev) => ({ ...prev, generalData: prev.generalData.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.mainCategoryId || !form.baseUnitId) {
      setError("Name, main category, and base unit are required.");
      return;
    }
    if (form.codeMode === "manual" && !form.code.trim()) {
      setError("Enter a product code, or switch to auto-generate.");
      return;
    }
    if (form.barcodeMode === "manual" && !form.barcode.trim()) {
      setError("Enter a barcode, or switch to system-generated.");
      return;
    }

    const generalDataObj: Record<string, string> = {};
    for (const row of form.generalData) {
      if (row.key.trim()) generalDataObj[row.key.trim()] = row.value;
    }

    const payload = {
      name: form.name.trim(),
      mainCategoryId: form.mainCategoryId,
      subCategoryId: form.subCategoryId || null,
      brandId: form.brandId || null,
      baseUnitId: form.baseUnitId,
      codeMode: form.codeMode,
      code: form.code.trim(),
      barcodeMode: form.barcodeMode,
      barcode: form.barcode.trim(),
      defaultPurchasePrice: form.defaultPurchasePrice.trim() ? Number(form.defaultPurchasePrice) : null,
      defaultSupplierId: form.defaultSupplierId || null,
      generalData: generalDataObj,
      prices: form.prices.map((p) => ({
        priceGroupId: p.priceGroupId,
        currencyId: p.currencyId,
        price: Number(p.price),
      })),
    };

    setSaving(true);
    setError("");
    try {
      const isEdit = panel.mode === "edit";
      const url = isEdit ? `/api/products/${panel.product.id}` : "/api/products";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Something went wrong.");
        return;
      }
      closePanel();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product: ProductDTO) {
    if (!confirm(`Delete product "${product.name}"?`)) return;
    const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Could not delete this product.");
      return;
    }
    router.refresh();
  }

  const selectClass =
    "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100";
  const inputClass =
    "h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-400";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" className="h-12 px-5 text-base" onClick={openCreate} disabled={missingPrerequisites}>
          + New Product
        </Button>
        <select
          value={filterMainCategoryId}
          onChange={(e) => setFilterMainCategoryId(e.target.value)}
          className="h-10 min-w-48 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
          aria-label="Filter by main category"
        >
          <option value="all">All Main Categories</option>
          {mainCategories.map((mc) => (
            <option key={mc.id} value={mc.id}>
              {mc.name} ({mc.type === "PRODUCT" ? "Product" : "Service"})
            </option>
          ))}
        </select>
      </div>

      {missingPrerequisites && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Create at least one Main Category, Base Unit, Currency, and Price Group before adding products.
        </div>
      )}

      {panel.mode !== "closed" && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="m-0 text-lg font-semibold text-slate-800">
              {panel.mode === "edit" ? "Edit Product" : "New Product"}
            </h2>
            <button
              type="button"
              onClick={closePanel}
              aria-label="Close"
              className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <label className={labelClass}>Product Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Main Category</label>
                <select
                  value={form.mainCategoryId}
                  onChange={(e) => handleMainCategoryChange(e.target.value)}
                  className={selectClass}
                >
                  {mainCategories.map((mc) => (
                    <option key={mc.id} value={mc.id}>
                      {mc.name} ({mc.type === "PRODUCT" ? "Product" : "Service"})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Sub Category (optional)</label>
                <select
                  value={form.subCategoryId}
                  onChange={(e) => updateField("subCategoryId", e.target.value)}
                  className={selectClass}
                >
                  <option value="">— None —</option>
                  {filteredSubCategories.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Brand (optional)</label>
                <select
                  value={form.brandId}
                  onChange={(e) => updateField("brandId", e.target.value)}
                  className={selectClass}
                >
                  <option value="">— None —</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Base Unit</label>
                <select
                  value={form.baseUnitId}
                  onChange={(e) => updateField("baseUnitId", e.target.value)}
                  className={selectClass}
                >
                  {baseUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  Stock is always stored in this smallest base unit.
                </p>
              </div>
              <div>
                <label className={labelClass}>Default Purchasing Price</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.defaultPurchasePrice}
                  onChange={(e) => updateField("defaultPurchasePrice", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Default Supplier (optional)</label>
                <select
                  value={form.defaultSupplierId}
                  onChange={(e) => updateField("defaultSupplierId", e.target.value)}
                  className={selectClass}
                >
                  <option value="">— None —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-4">
                <label className={labelClass}>Product Code</label>
                <div className="mb-2 flex gap-4 text-sm text-slate-700">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      checked={form.codeMode === "auto"}
                      onChange={() => updateField("codeMode", "auto")}
                    />
                    Auto-generate
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      checked={form.codeMode === "manual"}
                      onChange={() => updateField("codeMode", "manual")}
                    />
                    Manual
                  </label>
                </div>
                <input
                  type="text"
                  value={form.codeMode === "auto" ? "Generated on save" : form.code}
                  onChange={(e) => updateField("code", e.target.value)}
                  disabled={form.codeMode === "auto"}
                  className={inputClass}
                />
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <label className={labelClass}>Bar Code</label>
                <div className="mb-2 flex gap-4 text-sm text-slate-700">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      checked={form.barcodeMode === "system"}
                      onChange={() => updateField("barcodeMode", "system")}
                    />
                    System-generated
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      checked={form.barcodeMode === "manual"}
                      onChange={() => updateField("barcodeMode", "manual")}
                    />
                    Original (typed)
                  </label>
                </div>
                <input
                  type="text"
                  value={form.barcodeMode === "system" ? "Generated on save" : form.barcode}
                  onChange={(e) => updateField("barcode", e.target.value)}
                  disabled={form.barcodeMode === "system"}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className={labelClass + " mb-0"}>Selling Prices</label>
                <Button type="button" variant="outline" onClick={addPriceRow}>
                  + Add Price
                </Button>
              </div>
              {form.prices.length === 0 && (
                <p className="text-sm text-slate-400">
                  No selling prices yet. Add a price group + currency + amount.
                </p>
              )}
              <div className="space-y-2">
                {form.prices.map((row, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                    <select
                      value={row.priceGroupId}
                      onChange={(e) => updatePriceRow(index, { priceGroupId: e.target.value })}
                      className={selectClass}
                    >
                      {priceGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={row.currencyId}
                      onChange={(e) => updatePriceRow(index, { currencyId: e.target.value })}
                      className={selectClass}
                    >
                      {currencies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Price"
                      value={row.price}
                      onChange={(e) => updatePriceRow(index, { price: e.target.value })}
                      className={inputClass}
                    />
                    <Button type="button" variant="destructive" onClick={() => removePriceRow(index)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className={labelClass + " mb-0"}>General Data</label>
                <Button type="button" variant="outline" onClick={addGeneralDataRow}>
                  + Add Field
                </Button>
              </div>
              {form.generalData.length === 0 && (
                <p className="text-sm text-slate-400">
                  Optional free-form spec fields (e.g. Color, Size, Weight).
                </p>
              )}
              <div className="space-y-2">
                {form.generalData.map((row, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <input
                      type="text"
                      placeholder="Field name"
                      value={row.key}
                      onChange={(e) => updateGeneralDataRow(index, { key: e.target.value })}
                      className={inputClass}
                    />
                    <input
                      type="text"
                      placeholder="Value"
                      value={row.value}
                      onChange={(e) => updateGeneralDataRow(index, { value: e.target.value })}
                      className={inputClass}
                    />
                    <Button type="button" variant="destructive" onClick={() => removeGeneralDataRow(index)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Product"}
              </Button>
              <Button type="button" variant="outline" onClick={closePanel}>
                Cancel
              </Button>
            </div>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="m-0 text-lg font-semibold text-slate-800">Products</h2>
          <span className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {filteredProducts.length} of {products.length} total
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-white text-slate-500">
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Brand</th>
                <th className="px-4 py-3 font-semibold">Base Unit</th>
                <th className="px-4 py-3 font-semibold">Barcode</th>
                <th className="px-4 py-3 font-semibold">Prices</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length > 0 ? (
                filteredProducts.map((p) => (
                  <tr key={p.id} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-slate-700">{p.code}</td>
                    <td className="px-4 py-3 text-slate-700">{p.name}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {p.mainCategoryName}
                      {p.subCategoryName ? ` / ${p.subCategoryName}` : ""}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{p.brandName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{p.baseUnitName}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {p.barcode}{" "}
                      <span className="text-xs text-slate-400">
                        ({p.barcodeSource === "SYSTEM" ? "system" : "original"})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {p.prices.length > 0
                        ? p.prices.map((pr) => `${pr.priceGroupName} ${pr.price} ${pr.currencyCode}`).join(", ")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={() => openEdit(p)}>
                          Edit
                        </Button>
                        <Button type="button" variant="destructive" onClick={() => handleDelete(p)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    {products.length === 0 ? "No products created yet." : "No products match this filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
