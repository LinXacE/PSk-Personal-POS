"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { UnitDTO, UnitKind } from "@/types/product";

type UnitClientProps = {
  units: UnitDTO[];
};

type ModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; unit: UnitDTO };

const KIND_LABEL: Record<UnitKind, string> = {
  BASE: "Base",
  PURCHASE: "Purchase",
  SELLING: "Selling",
};

export function UnitClient({ units }: UnitClientProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [name, setName] = useState("");
  const [kind, setKind] = useState<UnitKind>("BASE");
  const [baseUnitId, setBaseUnitId] = useState("");
  const [conversionQty, setConversionQty] = useState("1");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const baseUnits = units.filter((u) => u.kind === "BASE");

  function openCreate() {
    setName("");
    setKind("BASE");
    setBaseUnitId(baseUnits[0]?.id ?? "");
    setConversionQty("1");
    setError("");
    setModal({ mode: "create" });
  }

  function openEdit(unit: UnitDTO) {
    setName(unit.name);
    setKind(unit.kind);
    setBaseUnitId(unit.baseUnitId ?? baseUnits[0]?.id ?? "");
    setConversionQty(String(unit.conversionQty));
    setError("");
    setModal({ mode: "edit", unit });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (kind !== "BASE" && !baseUnitId) {
      setError("Select a base unit for this purchase/selling unit.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const isEdit = modal.mode === "edit";
      const url = isEdit ? `/api/units/${modal.unit.id}` : "/api/units";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          kind,
          baseUnitId: kind === "BASE" ? null : baseUnitId,
          conversionQty: kind === "BASE" ? 1 : Number(conversionQty),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Something went wrong.");
        return;
      }
      setModal({ mode: "closed" });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(unit: UnitDTO) {
    if (!confirm(`Delete unit "${unit.name}"?`)) return;
    const res = await fetch(`/api/units/${unit.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Could not delete this unit.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap gap-3">
        <Button type="button" className="h-12 px-5 text-base" onClick={openCreate}>
          + New Unit
        </Button>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="m-0 text-lg font-semibold text-slate-800">Units</h2>
          <span className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {units.length} total
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-base">
            <thead>
              <tr className="bg-white text-slate-500">
                <th className="px-4 py-3 text-base font-semibold">Name</th>
                <th className="px-4 py-3 text-base font-semibold">Kind</th>
                <th className="px-4 py-3 text-base font-semibold">
                  Base Unit
                </th>
                <th className="px-4 py-3 text-base font-semibold">
                  Conversion
                </th>
                <th className="px-4 py-3 text-base font-semibold">Linked</th>
                <th className="px-4 py-3 text-base font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {units.length > 0 ? (
                units.map((u) => (
                  <tr key={u.id} className="border-t border-slate-200">
                    <td className="px-4 py-3.5 text-slate-700">{u.name}</td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {KIND_LABEL[u.kind]}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {u.baseUnitName ?? "—"}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {u.kind === "BASE"
                        ? "—"
                        : `1 ${u.name} = ${u.conversionQty} ${u.baseUnitName}`}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {u.productCount} products · {u.derivedUnitCount} units
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => openEdit(u)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => handleDelete(u)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    No units created yet. Start with a base unit (e.g.
                    &quot;pcs&quot;).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={modal.mode !== "closed"}
        title={modal.mode === "edit" ? "Edit Unit" : "New Unit"}
        onClose={() => setModal({ mode: "closed" })}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. pcs, carton, box"
              className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Kind
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as UnitKind)}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
            >
              <option value="BASE">Base</option>
              <option value="PURCHASE">Purchase</option>
              <option value="SELLING">Selling</option>
            </select>
          </div>

          {kind !== "BASE" && (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Base Unit
                </label>
                <select
                  value={baseUnitId}
                  onChange={(e) => setBaseUnitId(e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
                >
                  {baseUnits.length === 0 && (
                    <option value="">Create a base unit first</option>
                  )}
                  {baseUnits.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Conversion quantity (base units per 1 of this unit)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={conversionQty}
                  onChange={(e) => setConversionQty(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
                />
              </div>
            </>
          )}

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </form>
      </Modal>
    </section>
  );
}
