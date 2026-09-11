"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { PriceGroupDTO } from "@/types/settings";

type PriceGroupClientProps = { priceGroups: PriceGroupDTO[] };

type ModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; priceGroup: PriceGroupDTO };

export function PriceGroupClient({ priceGroups }: PriceGroupClientProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setName("");
    setIsDefault(priceGroups.length === 0);
    setError("");
    setModal({ mode: "create" });
  }

  function openEdit(g: PriceGroupDTO) {
    setName(g.name);
    setIsDefault(g.isDefault);
    setError("");
    setModal({ mode: "edit", priceGroup: g });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const isEdit = modal.mode === "edit";
      const url = isEdit
        ? `/api/price-groups/${modal.priceGroup.id}`
        : "/api/price-groups";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, isDefault }),
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

  async function handleDelete(g: PriceGroupDTO) {
    if (!confirm(`Delete price group "${g.name}"?`)) return;
    const res = await fetch(`/api/price-groups/${g.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Could not delete this price group.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={openCreate}>
          New Price Group
        </Button>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="m-0 text-lg font-semibold text-slate-800">
            Price Groups
          </h2>
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {priceGroups.length} total
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-white text-slate-500">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Default</th>
                <th className="px-4 py-3 font-semibold">Linked Prices</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {priceGroups.length > 0 ? (
                priceGroups.map((g) => (
                  <tr key={g.id} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-slate-700">{g.name}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {g.isDefault ? "Yes" : ""}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {g.productPriceCount}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => openEdit(g)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => handleDelete(g)}
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
                    colSpan={4}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    No price groups created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={modal.mode !== "closed"}
        title={modal.mode === "edit" ? "Edit Price Group" : "New Price Group"}
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
              Name (e.g. Retail, Wholesale, VIP)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Set as default price group
          </label>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </form>
      </Modal>
    </section>
  );
}
