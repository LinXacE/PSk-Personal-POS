"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { PurchaseOrderDTO, PurchaseOrderLineDTO } from "@/types/purchase";
import type { UnitDTO } from "@/types/product";
import type { SupplierDTO, WarehouseDTO, CurrencyDTO } from "@/types/settings";

type ProductOption = {
  id: string;
  name: string;
  code: string;
  baseUnitId: string;
  baseUnitName: string;
};

type PurchaseClientProps = {
  purchaseOrders: PurchaseOrderDTO[];
  products: ProductOption[];
  units: UnitDTO[];
  suppliers: SupplierDTO[];
  warehouses: WarehouseDTO[];
  currencies: CurrencyDTO[];
};

type LineRow = {
  id?: string;
  productId: string;
  entryUnitId: string;
  entryQuantity: string;
  unitCost: string;
};

type FormState = {
  referenceMode: "auto" | "manual";
  reference: string;
  supplierId: string;
  currencyId: string;
  warehouseId: string;
  orderedAt: string;
  note: string;
  amountPaid: string;
  lines: LineRow[];
};

type PanelState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; order: PurchaseOrderDTO };

type ReceiveRow = {
  lineId: string;
  productName: string;
  entryUnitName: string;
  remainingEntryQty: number;
  receiveEntryQuantity: string;
  batchMode: "auto" | "manual";
  batchNumber: string;
  expiryDate: string;
};

type ReceiveState = { mode: "closed" } | { mode: "open"; order: PurchaseOrderDTO; rows: ReceiveRow[] };
type PaymentState = { mode: "closed" } | { mode: "open"; order: PurchaseOrderDTO; amountPaid: string };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(suppliers: SupplierDTO[], currencies: CurrencyDTO[], warehouses: WarehouseDTO[]): FormState {
  return {
    referenceMode: "auto",
    reference: "",
    supplierId: suppliers[0]?.id ?? "",
    currencyId: currencies.find((c) => c.isDefault)?.id ?? currencies[0]?.id ?? "",
    warehouseId: warehouses[0]?.id ?? "",
    orderedAt: todayIso(),
    note: "",
    amountPaid: "0",
    lines: [],
  };
}

function formFromOrder(order: PurchaseOrderDTO): FormState {
  return {
    referenceMode: order.referenceIsAuto ? "auto" : "manual",
    reference: order.reference,
    supplierId: order.supplierId,
    currencyId: order.currencyId,
    warehouseId: order.warehouseId,
    orderedAt: order.orderedAt.slice(0, 10),
    note: order.note ?? "",
    amountPaid: String(order.amountPaid),
    lines: order.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      entryUnitId: l.entryUnitId,
      entryQuantity: String(l.entryQuantity),
      unitCost: String(l.unitCost),
    })),
  };
}

const STATUS_LABEL: Record<PurchaseOrderDTO["status"], string> = {
  ORDERED: "Ordered",
  PARTIALLY_RECEIVED: "Partially Received",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

const STATUS_STYLE: Record<PurchaseOrderDTO["status"], string> = {
  ORDERED: "bg-amber-50 text-amber-700 border-amber-200",
  PARTIALLY_RECEIVED: "bg-sky-50 text-sky-700 border-sky-200",
  RECEIVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
};

const PAYMENT_LABEL: Record<PurchaseOrderDTO["paymentStatus"], string> = {
  UNPAID: "Unpaid",
  PARTIAL: "Partial",
  PAID: "Paid",
};

const PAYMENT_STYLE: Record<PurchaseOrderDTO["paymentStatus"], string> = {
  UNPAID: "bg-red-50 text-red-700 border-red-200",
  PARTIAL: "bg-amber-50 text-amber-700 border-amber-200",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function PurchaseClient({
  purchaseOrders,
  products,
  units,
  suppliers,
  warehouses,
  currencies,
}: PurchaseClientProps) {
  const router = useRouter();
  const [panel, setPanel] = useState<PanelState>({ mode: "closed" });
  const [form, setForm] = useState<FormState>(emptyForm(suppliers, currencies, warehouses));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [receive, setReceive] = useState<ReceiveState>({ mode: "closed" });
  const [receiveError, setReceiveError] = useState("");
  const [receiveSaving, setReceiveSaving] = useState(false);
  const [payment, setPayment] = useState<PaymentState>({ mode: "closed" });
  const [paymentError, setPaymentError] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);

  const missingPrerequisites =
    products.length === 0 || suppliers.length === 0 || warehouses.length === 0 || currencies.length === 0;

  function unitsForProduct(productId: string) {
    const product = productById.get(productId);
    if (!product) return [];
    return units.filter((u) => u.id === product.baseUnitId || u.baseUnitId === product.baseUnitId);
  }

  function openCreate() {
    setForm(emptyForm(suppliers, currencies, warehouses));
    setError("");
    setPanel({ mode: "create" });
  }

  function openEdit(order: PurchaseOrderDTO) {
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
    setForm((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          productId: firstProduct?.id ?? "",
          entryUnitId: defaultUnits[0]?.id ?? "",
          entryQuantity: "",
          unitCost: "",
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
    updateLine(index, { productId, entryUnitId: validUnits[0]?.id ?? "" });
  }

  function removeLine(index: number) {
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));
  }

  const formTotal = form.lines.reduce((sum, l) => {
    const qty = Number(l.entryQuantity) || 0;
    const cost = Number(l.unitCost) || 0;
    return sum + qty * cost;
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.supplierId || !form.currencyId || !form.warehouseId) {
      setError("Supplier, currency, and warehouse are required.");
      return;
    }
    if (form.referenceMode === "manual" && !form.reference.trim()) {
      setError("Enter a reference, or switch to auto-generate.");
      return;
    }
    if (form.lines.length === 0) {
      setError("Add at least one purchase line.");
      return;
    }
    for (const line of form.lines) {
      if (!line.productId || !line.entryUnitId || !line.entryQuantity || !line.unitCost) {
        setError("Every line needs a product, unit, quantity, and unit cost.");
        return;
      }
    }

    const payload = {
      referenceMode: form.referenceMode,
      reference: form.reference.trim(),
      supplierId: form.supplierId,
      currencyId: form.currencyId,
      warehouseId: form.warehouseId,
      orderedAt: form.orderedAt,
      note: form.note.trim(),
      amountPaid: Number(form.amountPaid) || 0,
      lines: form.lines.map((l) => ({
        productId: l.productId,
        entryUnitId: l.entryUnitId,
        entryQuantity: Number(l.entryQuantity),
        unitCost: Number(l.unitCost),
      })),
    };

    setSaving(true);
    setError("");
    try {
      const isEdit = panel.mode === "edit";
      const url = isEdit ? `/api/purchases/${panel.order.id}` : "/api/purchases";
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

  async function handleDelete(order: PurchaseOrderDTO) {
    if (!confirm(`Delete purchase order "${order.reference}"?`)) return;
    const res = await fetch(`/api/purchases/${order.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Could not delete this purchase order.");
      return;
    }
    router.refresh();
  }

  async function handleCancel(order: PurchaseOrderDTO) {
    if (!confirm(`Cancel purchase order "${order.reference}"? Nothing has been received yet, so this is safe.`)) return;
    const res = await fetch(`/api/purchases/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancel: true }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Could not cancel this purchase order.");
      return;
    }
    router.refresh();
  }

  function openReceive(order: PurchaseOrderDTO) {
    const rows: ReceiveRow[] = order.lines
      .filter((l) => (l.receivedQuantity ?? 0) < (l.quantity ?? 0) - 1e-6)
      .map((l) => buildReceiveRow(l));
    setReceiveError("");
    setReceive({ mode: "open", order, rows });
  }

  function buildReceiveRow(l: PurchaseOrderLineDTO): ReceiveRow {
    const unit = unitById.get(l.entryUnitId);
    const conversionQty = unit?.conversionQty ?? 1;
    const remainingBase = (l.quantity ?? 0) - (l.receivedQuantity ?? 0);
    const remainingEntryQty = remainingBase / conversionQty;
    return {
      lineId: l.id!,
      productName: `${l.productName} (${l.productCode})`,
      entryUnitName: l.entryUnitName ?? "",
      remainingEntryQty,
      receiveEntryQuantity: "",
      batchMode: "auto",
      batchNumber: "",
      expiryDate: "",
    };
  }

  function updateReceiveRow(index: number, patch: Partial<ReceiveRow>) {
    setReceive((prev) => {
      if (prev.mode !== "open") return prev;
      return { ...prev, rows: prev.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)) };
    });
  }

  function fillFullyReceived() {
    setReceive((prev) => {
      if (prev.mode !== "open") return prev;
      return {
        ...prev,
        rows: prev.rows.map((row) => ({ ...row, receiveEntryQuantity: String(row.remainingEntryQty) })),
      };
    });
  }

  async function handleReceiveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (receive.mode !== "open") return;
    const linesToSend = receive.rows
      .filter((r) => r.receiveEntryQuantity.trim() !== "" && Number(r.receiveEntryQuantity) > 0)
      .map((r) => ({
        lineId: r.lineId,
        receiveEntryQuantity: Number(r.receiveEntryQuantity),
        batchMode: r.batchMode,
        batchNumber: r.batchMode === "manual" ? r.batchNumber.trim() : undefined,
        expiryDate: r.expiryDate || null,
      }));

    if (linesToSend.length === 0) {
      setReceiveError("Enter a received quantity for at least one line.");
      return;
    }
    for (const r of receive.rows) {
      if (r.batchMode === "manual" && r.receiveEntryQuantity.trim() !== "" && !r.batchNumber.trim()) {
        setReceiveError("Enter a batch number for every line using manual batch numbering.");
        return;
      }
    }

    setReceiveSaving(true);
    setReceiveError("");
    try {
      const res = await fetch(`/api/purchases/${receive.order.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: linesToSend }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setReceiveError(data?.error ?? "Something went wrong.");
        return;
      }
      setReceive({ mode: "closed" });
      router.refresh();
    } finally {
      setReceiveSaving(false);
    }
  }

  function openPayment(order: PurchaseOrderDTO) {
    setPaymentError("");
    setPayment({ mode: "open", order, amountPaid: String(order.amountPaid) });
  }

  async function handlePaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (payment.mode !== "open") return;
    const amountPaid = Number(payment.amountPaid);
    if (Number.isNaN(amountPaid) || amountPaid < 0) {
      setPaymentError("Amount paid must be a positive number.");
      return;
    }
    setPaymentSaving(true);
    setPaymentError("");
    try {
      const res = await fetch(`/api/purchases/${payment.order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentOnly: true, amountPaid }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setPaymentError(data?.error ?? "Something went wrong.");
        return;
      }
      setPayment({ mode: "closed" });
      router.refresh();
    } finally {
      setPaymentSaving(false);
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
          + New Purchase Order
        </Button>
      </div>

      {missingPrerequisites && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Create at least one Product, Supplier, Warehouse, and Currency before adding purchase orders.
        </div>
      )}

      {panel.mode !== "closed" && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="m-0 text-lg font-semibold text-slate-800">
              {panel.mode === "edit" ? "Edit Purchase Order" : "New Purchase Order"}
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

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={labelClass}>Supplier</label>
                <select
                  value={form.supplierId}
                  onChange={(e) => updateField("supplierId", e.target.value)}
                  className={selectClass}
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
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
                <p className="mt-1 text-xs text-slate-400">Goods will be received into this warehouse.</p>
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
                <label className={labelClass}>Order Date</label>
                <input
                  type="date"
                  value={form.orderedAt}
                  onChange={(e) => updateField("orderedAt", e.target.value)}
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
                <label className={labelClass + " mb-0"}>Purchase Lines</label>
                <Button type="button" variant="outline" onClick={addLine}>
                  + Add Line
                </Button>
              </div>
              {form.lines.length === 0 && (
                <p className="text-sm text-slate-400">Add at least one product, unit, quantity, and cost.</p>
              )}
              <div className="space-y-2">
                {form.lines.map((row, index) => {
                  const validUnits = unitsForProduct(row.productId);
                  const lineTotal = (Number(row.entryQuantity) || 0) * (Number(row.unitCost) || 0);
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
                        placeholder="Unit cost"
                        value={row.unitCost}
                        onChange={(e) => updateLine(index, { unitCost: e.target.value })}
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Amount Paid</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.amountPaid}
                  onChange={(e) => updateField("amountPaid", e.target.value)}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-slate-400">
                  Payment status is calculated automatically from this amount vs. the order total.
                </p>
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
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Purchase Order"}
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
          <h2 className="m-0 text-lg font-semibold text-slate-800">Purchase Orders</h2>
          <span className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {purchaseOrders.length} total
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-white text-slate-500">
                <th className="px-4 py-3 font-semibold">Reference</th>
                <th className="px-4 py-3 font-semibold">Supplier</th>
                <th className="px-4 py-3 font-semibold">Warehouse</th>
                <th className="px-4 py-3 font-semibold">Ordered</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.length > 0 ? (
                purchaseOrders.map((o) => (
                  <tr key={o.id} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-slate-700">{o.reference}</td>
                    <td className="px-4 py-3 text-slate-500">{o.supplierName}</td>
                    <td className="px-4 py-3 text-slate-500">{o.warehouseName}</td>
                    <td className="px-4 py-3 text-slate-500">{o.orderedAt.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[o.status]}`}>
                        {STATUS_LABEL[o.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${PAYMENT_STYLE[o.paymentStatus]}`}
                      >
                        {PAYMENT_LABEL[o.paymentStatus]}
                      </span>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {o.amountPaid.toFixed(2)} / {o.totalAmount.toFixed(2)} {o.currencyCode}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {o.totalAmount.toFixed(2)} {o.currencyCode}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {o.status === "ORDERED" && (
                          <Button type="button" variant="outline" onClick={() => openEdit(o)}>
                            Edit
                          </Button>
                        )}
                        {(o.status === "ORDERED" || o.status === "PARTIALLY_RECEIVED") && (
                          <Button type="button" onClick={() => openReceive(o)}>
                            Receive
                          </Button>
                        )}
                        <Button type="button" variant="outline" onClick={() => openPayment(o)}>
                          Payment
                        </Button>
                        {o.status === "ORDERED" && (
                          <>
                            <Button type="button" variant="outline" onClick={() => handleCancel(o)}>
                              Cancel
                            </Button>
                            <Button type="button" variant="destructive" onClick={() => handleDelete(o)}>
                              Delete
                            </Button>
                          </>
                        )}
                        {o.status === "CANCELLED" && (
                          <Button type="button" variant="destructive" onClick={() => handleDelete(o)}>
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    No purchase orders created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={receive.mode === "open"}
        title={receive.mode === "open" ? `Receive: ${receive.order.reference}` : "Receive"}
        onClose={() => setReceive({ mode: "closed" })}
      >
        {receive.mode === "open" && (
          <form onSubmit={handleReceiveSubmit} className="space-y-4">
            {receiveError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {receiveError}
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Enter how much actually arrived for each line. Leave blank to skip a line for now.
              </p>
              <Button type="button" variant="outline" onClick={fillFullyReceived}>
                Fill all remaining
              </Button>
            </div>
            <div className="max-h-96 space-y-4 overflow-y-auto">
              {receive.rows.map((row, index) => (
                <div key={row.lineId} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-700">{row.productName}</p>
                  <p className="mb-2 text-xs text-slate-400">
                    Remaining: {row.remainingEntryQty.toFixed(2)} {row.entryUnitName}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder={`Received (${row.entryUnitName})`}
                      value={row.receiveEntryQuantity}
                      onChange={(e) => updateReceiveRow(index, { receiveEntryQuantity: e.target.value })}
                      className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
                    />
                    <input
                      type="date"
                      value={row.expiryDate}
                      onChange={(e) => updateReceiveRow(index, { expiryDate: e.target.value })}
                      className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
                      title="Expiry date (optional)"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-700">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={row.batchMode === "auto"}
                        onChange={() => updateReceiveRow(index, { batchMode: "auto" })}
                      />
                      Auto batch number
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={row.batchMode === "manual"}
                        onChange={() => updateReceiveRow(index, { batchMode: "manual" })}
                      />
                      Manual
                    </label>
                    {row.batchMode === "manual" && (
                      <input
                        type="text"
                        placeholder="Batch number"
                        value={row.batchNumber}
                        onChange={(e) => updateReceiveRow(index, { batchNumber: e.target.value })}
                        className="h-9 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
                      />
                    )}
                  </div>
                </div>
              ))}
              {receive.rows.length === 0 && (
                <p className="text-sm text-slate-400">Every line on this order has already been fully received.</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={receiveSaving || receive.rows.length === 0}>
              {receiveSaving ? "Receiving..." : "Confirm Receive"}
            </Button>
          </form>
        )}
      </Modal>

      <Modal
        open={payment.mode === "open"}
        title={payment.mode === "open" ? `Payment: ${payment.order.reference}` : "Payment"}
        onClose={() => setPayment({ mode: "closed" })}
      >
        {payment.mode === "open" && (
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            {paymentError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {paymentError}
              </div>
            )}
            <p className="text-sm text-slate-500">
              Order total: {payment.order.totalAmount.toFixed(2)} {payment.order.currencyCode}
            </p>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Amount Paid</label>
              <input
                type="number"
                min="0"
                step="any"
                value={payment.amountPaid}
                onChange={(e) => setPayment({ ...payment, amountPaid: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
              />
            </div>
            <Button type="submit" className="w-full" disabled={paymentSaving}>
              {paymentSaving ? "Saving..." : "Save Payment"}
            </Button>
          </form>
        )}
      </Modal>
    </section>
  );
}
