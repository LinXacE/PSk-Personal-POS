"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { SupplierDTO } from "@/types/settings";

type SupplierClientProps = { suppliers: SupplierDTO[] };

type ModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; supplier: SupplierDTO };

export function SupplierClient({ suppliers }: SupplierClientProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setName("");
    setContact("");
    setAddress("");
    setError("");
    setModal({ mode: "create" });
  }

  function openEdit(s: SupplierDTO) {
    setName(s.name);
    setContact(s.contact ?? "");
    setAddress(s.address ?? "");
    setError("");
    setModal({ mode: "edit", supplier: s });
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
        ? `/api/suppliers/${modal.supplier.id}`
        : "/api/suppliers";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact, address }),
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

  async function handleDelete(s: SupplierDTO) {
    if (!confirm(`Delete supplier "${s.name}"?`)) return;
    const res = await fetch(`/api/suppliers/${s.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Could not delete this supplier.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={openCreate}>
          New Supplier
        </Button>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="m-0 text-lg font-semibold text-slate-800">
            Suppliers
          </h2>
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {suppliers.length} total
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-white text-slate-500">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Address</th>
                <th className="px-4 py-3 font-semibold">Linked</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length > 0 ? (
                suppliers.map((s) => (
                  <tr key={s.id} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-slate-700">{s.name}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {s.contact ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {s.address ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {s.productCount} products · {s.purchaseCount} purchases
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => openEdit(s)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => handleDelete(s)}
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
                    colSpan={5}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    No suppliers created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={modal.mode !== "closed"}
        title={modal.mode === "edit" ? "Edit Supplier" : "New Supplier"}
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
              className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Contact
            </label>
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
            />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </form>
      </Modal>
    </section>
  );
}
