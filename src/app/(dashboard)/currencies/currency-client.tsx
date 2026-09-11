"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { CurrencyDTO } from "@/types/settings";

type CurrencyClientProps = { currencies: CurrencyDTO[] };

type ModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; currency: CurrencyDTO };

export function CurrencyClient({ currencies }: CurrencyClientProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setCode("");
    setName("");
    setExchangeRate("1");
    setIsDefault(currencies.length === 0);
    setError("");
    setModal({ mode: "create" });
  }

  function openEdit(c: CurrencyDTO) {
    setCode(c.code);
    setName(c.name);
    setExchangeRate(String(c.exchangeRate));
    setIsDefault(c.isDefault);
    setError("");
    setModal({ mode: "edit", currency: c });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError("Code and name are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const isEdit = modal.mode === "edit";
      const url = isEdit
        ? `/api/currencies/${modal.currency.id}`
        : "/api/currencies";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name,
          exchangeRate: Number(exchangeRate),
          isDefault,
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

  async function handleDelete(c: CurrencyDTO) {
    if (!confirm(`Delete currency "${c.code}"?`)) return;
    const res = await fetch(`/api/currencies/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Could not delete this currency.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={openCreate}>
          New Currency
        </Button>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="m-0 text-lg font-semibold text-slate-800">
            Currencies
          </h2>
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {currencies.length} total
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-white text-slate-500">
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Exchange Rate</th>
                <th className="px-4 py-3 font-semibold">Default</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currencies.length > 0 ? (
                currencies.map((c) => (
                  <tr key={c.id} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-slate-700">{c.code}</td>
                    <td className="px-4 py-3 text-slate-700">{c.name}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {c.exchangeRate}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {c.isDefault ? "Yes" : ""}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => openEdit(c)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => handleDelete(c)}
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
                    No currencies created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={modal.mode !== "closed"}
        title={modal.mode === "edit" ? "Edit Currency" : "New Currency"}
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
              Code (e.g. MMK, USD)
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 uppercase outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
            />
          </div>
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
              Exchange rate (relative to default currency)
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Set as default currency
          </label>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </form>
      </Modal>
    </section>
  );
}
