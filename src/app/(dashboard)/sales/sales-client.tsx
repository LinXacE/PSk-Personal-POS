"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { SalesOrderDTO, SalesProductOption } from "@/types/sales";
import type { UnitDTO } from "@/types/product";
import type { CustomerDTO, WarehouseDTO, CurrencyDTO, PriceGroupDTO } from "@/types/settings";

type SalesClientProps = {
  salesOrders: SalesOrderDTO[];
  products: SalesProductOption[];
  units: UnitDTO[];
  customers: CustomerDTO[];
  warehouses: WarehouseDTO[];
  currencies: CurrencyDTO[];
  priceGroups: PriceGroupDTO[];
};

type LineRow = {
  id?: string;
  productId: string;
  entryUnitId: string;
  entryQuantity: string;
  unitPrice: string;
};

type FormState = {
  referenceMode: "auto" | "manual";
  reference: string;
  customerId: string;
  currencyId: string;
  warehouseId: string;
  priceGroupId: string;
  soldAt: string;
  note: string;
  lines: LineRow[];
};

type PanelState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; order: SalesOrderDTO };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(currencies: CurrencyDTO[], warehouses: WarehouseDTO[], priceGroups: PriceGroupDTO[]): FormState {
  return {
    referenceMode: "auto",
    reference: "",
    customerId: "",
    currencyId: currencies.find((c) => c.isDefault)?.id ?? currencies[0]?.id ?? "",
    warehouseId: warehouses[0]?.id ?? "",
    priceGroupId: priceGroups.find((g) => g.isDefault)?.id ?? priceGroups[0]?.id ?? "",
    soldAt: todayIso(),
    note: "",
    lines: [],
  };
}

function formFromOrder(order: SalesOrderDTO): FormState {
  return {
    referenceMode: order.referenceIsAuto ? "auto" : "manual",
    reference: order.reference,
    customerId: order.customerId ?? "",
    currencyId: order.currencyId,
    warehouseId: order.warehouseId,
    priceGroupId: order.priceGroupId ?? "",
    soldAt: order.soldAt.slice(0, 10),
    note: order.note ?? "",
    lines: order.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      entryUnitId: l.entryUnitId,
      entryQuantity: String(l.entryQuantity),
      unitPrice: String(l.unitPrice),
    })),
  };
}

const STATUS_LABEL: Record<SalesOrderDTO["status"], string> = {
  DRAFT: "Draft",
  COMPLETED: "Completed",
};

const STATUS_STYLE: Record<SalesOrderDTO["status"], string> = {
  DRAFT: "bg-amber-50 text-amber-700 border-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function SalesClient({
  salesOrders,
  products,
  units,
  customers,
  warehouses,
  currencies,
  priceGroups,
}: SalesClientProps) {
  const router = useRouter();
  const [panel, setPanel] = useState<PanelState>({ mode: "closed" });
  const [form, setForm] = useState<FormState>(emptyForm(currencies, warehouses, priceGroups));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const missingPrerequisites =
    products.length === 0 || warehouses.length === 0 || currencies.length === 0;

  function unitsForProduct(productId: string) {
    const product = productById.get(productId);
    if (!product) return [];
    return units.filter((u) => u.id === product.baseUnitId || u.baseUnitId === product.baseUnitId);
  }

  function autoPrice(productId: string, priceGroupId: string, currencyId: string): string {
    const product = productById.get(productId);
    if (!product) return "";
    const match = product.prices.find((p) => p.priceGroupId === priceGroupId && p.currencyId === currencyId);
    return match ? String(match.price) : "";
  }

  function openCreate() {
    setForm(emptyForm(currencies, warehouses, priceGroups));
    setError("");
    setPanel({ mode: "create" });
  }

  function openEdit(order: SalesOrderDTO) {
    setForm(formFromOrder(order));
    setError("");
    setPanel({ mode: "edit", order });
  }

  function closePanel() {
    setPanel({ mode: "closed" });
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addLine() {
    const firstProduct = products[0];
    const defaultUnits = firstProduct ? unitsForProduct(firstProduct.id) : [];
    const unitPrice = firstProduct ? autoPrice(firstProduct.id, form.priceGroupId, form.currencyId) : "";
    setForm((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          productId: firstProduct?.id ?? "",
          entryUnitId: defaultUnits[0]?.id ?? "",
          entryQuantity: "",
          unitPrice,
        },
      ],
    }));
  }

  function updateLine(index: number, patch: Partial<LineRow>) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }

  function handleLineProductChange(index: number, productId: string) {
    const validUnits = unitsForProduct(productId);
    const unitPrice = autoPrice(productId, form.priceGroupId, form.currencyId);
    updateLine(index, { productId, entryUnitId: validUnits[0]?.id ?? "", unitPrice });
  }

  function removeLine(index: number) {
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));
  }

  const formTotal = form.lines.reduce((sum, l) => {
    const qty = Number(l.entryQuantity) || 0;
    const price = Number(l.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.currencyId || !form.warehouseId) {
      setError("Currency and warehouse are required.");
      return;
    }
    if (form.referenceMode === "manual" && !form.reference.trim()) {
      setError("Enter a reference, or switch to auto-generate.");
      return;
    }
    if (form.lines.length === 0) {
      setError("Add at least one sales line.");
      return;
    }
    for (const line of form.lines) {
      if (!line.productId || !line.entryUnitId || !line.entryQuantity || !line.unitPrice) {
        setError("Every line needs a product, unit, quantity, and unit price.");
        return;
      }
    }

    const payload = {
      referenceMode: form.referenceMode,
      reference: form.reference.trim(),
      customerId: form.customerId || null,
      currencyId: form.currencyId,
      warehouseId: form.warehouseId,
      priceGroupId: form.priceGroupId || null,
      soldAt: form.soldAt,
      note: form.note.trim(),
      lines: form.lines.map((l) => ({
        productId: l.productId,
        entryUnitId: l.entryUnitId,
        entryQuantity: Number(l.entryQuantity),
        unitPrice: Number(l.unitPrice),
      })),
    };

    setSaving(true);
    setError("");
    try {
      const isEdit = panel.mode === "edit";
      const url = isEdit ? `/api/sales/${panel.order.id}` : "/api/sales";
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

  async function handleDelete(order: SalesOrderDTO) {
    if (!confirm(`Delete sale "${order.reference}"?`)) return;
    const res = await fetch(`/api/sales/${order.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Could not delete this sale.");
      return;
    }
    router.refresh();
  }

  async function handleComplete(order: SalesOrderDTO) {
    if (
      !confirm(
        `Complete sale "${order.reference}"? Stock will be deducted from ${order.warehouseName} using soonest-expiry-first batches. This cannot be undone.`,
      )
    )
      return;
    setCompletingId(order.id);
    try {
      const res = await fetch(`/api/sales/${order.id}/complete`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error ?? "Could not complete this sale.");
        return;
      }
      router.refresh();
    } finally {
      setCompletingId(null);
    }
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
          + New Sale
        </Button>
      </div>

      {missingPrerequisites && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Create at least one Product, Warehouse, and Currency before recording sales.
        </div>
      )}

      {panel.mode !== "closed" && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="m-0 text-lg font-semibold text-slate-800">
              {panel.mode === "edit" ? "Edit Sale" : "New Sale"}
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
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className={labelClass}>Customer (optional — walk-in)</label>
                <select
                  value={form.customerId}
                  onChange={(e) => updateField("customerId", e.target.value)}
                  className={selectClass}
                >
                  <option value="">Walk-in customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Warehouse</label>
                <select
                  value={form.warehouseId}
                  onChange={(e) => updateField("warehouseId", e.target.value)}
                  className={selectClass}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">Stock will be deducted from this warehouse.</p>
              </div>
              <div>
                <label className={labelClass}>Currency</label>
                <select
                  value={form.currencyId}
                  onChange={(e) => updateField("currencyId", e.target.value)}
                  className={selectClass}
                >
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Price Group</label>
                <select
                  value={form.priceGroupId}
                  onChange={(e) => updateField("priceGroupId", e.target.value)}
                  className={selectClass}
                >
                  <option value="">None</option>
                  {priceGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">Used to auto-fill line prices; still editable per line.</p>
              </div>
              <div>
                <label className={labelClass}>Sale Date</label>
                <input
                  type="date"
                  value={form.soldAt}
                  onChange={(e) => updateField("soldAt", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <label className={labelClass}>Reference Number</label>
              <div className="mb-2 flex gap-4 text-sm text-slate-700">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={form.referenceMode === "auto"}
                    onChange={() => updateField("referenceMode", "auto")}
                  />
                  Auto-generate
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={form.referenceMode === "manual"}
                    onChange={() => updateField("referenceMode", "manual")}
                  />
                  Manual
                </label>
              </div>
              <input
                type="text"
                value={form.referenceMode === "auto" ? "Generated on save" : form.reference}
                onChange={(e) => updateField("reference", e.target.value)}
                disabled={form.referenceMode === "auto"}
                className={inputClass}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className={labelClass + " mb-0"}>Sales Lines</label>
                <Button type="button" variant="outline" onClick={addLine}>
                  + Add Line
                </Button>
              </div>
              {form.lines.length === 0 && (
                <p className="text-sm text-slate-400">Add at least one product, unit, quantity, and price.</p>
              )}
              <div className="space-y-2">
                {form.lines.map((row, index) => {
                  const validUnits = unitsForProduct(row.productId);
                  const lineTotal = (Number(row.entryQuantity) || 0) * (Number(row.unitPrice) || 0);
                  return (
                    <div key={index} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-center gap-2">
                      <select
                        value={row.productId}
                        onChange={(e) => handleLineProductChange(index, e.target.value)}
                        className={selectClass}
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.code})
                          </option>
                        ))}
                      </select>
                      <select
                        value={row.entryUnitId}
                        onChange={(e) => updateLine(index, { entryUnitId: e.target.value })}
                        className={selectClass}
                      >
                        {validUnits.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Qty"
                        value={row.entryQuantity}
                        onChange={(e) => updateLine(index, { entryQuantity: e.target.value })}
                        className={inputClass}
                      />
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Unit price"
                        value={row.unitPrice}
                        onChange={(e) => updateLine(index, { unitPrice: e.target.value })}
                        className={inputClass}
                      />
                      <div className="text-sm text-slate-500">{lineTotal.toFixed(2)}</div>
                      <Button type="button" variant="destructive" onClick={() => removeLine(index)}>
                        Remove
                      </Button>
                    </div>
                  );
                })}
              </div>
              {form.lines.length > 0 && (
                <p className="mt-2 text-right text-sm font-semibold text-slate-700">
                  Total: {formTotal.toFixed(2)}
                </p>
              )}
            </div>

            <div>
              <label className={labelClass}>Note (optional)</label>
              <input
                type="text"
                value={form.note}
                onChange={(e) => updateField("note", e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Draft"}
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
          <h2 className="m-0 text-lg font-semibold text-slate-800">Sales</h2>
          <span className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {salesOrders.length} total
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-white text-slate-500">
                <th className="px-4 py-3 font-semibold">Reference</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Warehouse</th>
                <th className="px-4 py-3 font-semibold">Sold</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {salesOrders.length > 0 ? (
                salesOrders.map((o) => (
                  <tr key={o.id} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-slate-700">{o.reference}</td>
                    <td className="px-4 py-3 text-slate-500">{o.customerName ?? "Walk-in"}</td>
                    <td className="px-4 py-3 text-slate-500">{o.warehouseName}</td>
                    <td className="px-4 py-3 text-slate-500">{o.soldAt.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[o.status]}`}>
                        {STATUS_LABEL[o.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {o.totalAmount.toFixed(2)} {o.currencyCode}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {o.status === "DRAFT" && (
                          <>
                            <Button type="button" variant="outline" onClick={() => openEdit(o)}>
                              Edit
                            </Button>
                            <Button
                              type="button"
                              onClick={() => handleComplete(o)}
                              disabled={completingId === o.id}
                            >
                              {completingId === o.id ? "Completing..." : "Complete Sale"}
                            </Button>
                            <Button type="button" variant="destructive" onClick={() => handleDelete(o)}>
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    No sales recorded yet.
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
