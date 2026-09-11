"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { MainCategoryDTO, SubCategoryDTO } from "@/types/product";

type SubCategoryClientProps = {
  subCategories: SubCategoryDTO[];
  mainCategories: MainCategoryDTO[];
};

type ModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; subCategory: SubCategoryDTO };

export function SubCategoryClient({
  subCategories,
  mainCategories,
}: SubCategoryClientProps) {
  const router = useRouter();
  const [filterMainCategoryId, setFilterMainCategoryId] = useState("all");
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [name, setName] = useState("");
  const [mainCategoryId, setMainCategoryId] = useState(
    mainCategories[0]?.id ?? "",
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered =
    filterMainCategoryId === "all"
      ? subCategories
      : subCategories.filter((s) => s.mainCategoryId === filterMainCategoryId);

  function openCreate() {
    setName("");
    setMainCategoryId(mainCategories[0]?.id ?? "");
    setError("");
    setModal({ mode: "create" });
  }

  function openEdit(subCategory: SubCategoryDTO) {
    setName(subCategory.name);
    setMainCategoryId(subCategory.mainCategoryId);
    setError("");
    setModal({ mode: "edit", subCategory });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !mainCategoryId) {
      setError("Name and main category are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const isEdit = modal.mode === "edit";
      const url = isEdit
        ? `/api/sub-categories/${modal.subCategory.id}`
        : "/api/sub-categories";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mainCategoryId }),
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

  async function handleDelete(subCategory: SubCategoryDTO) {
    if (!confirm(`Delete sub-category "${subCategory.name}"?`)) return;
    const res = await fetch(`/api/sub-categories/${subCategory.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Could not delete this sub-category.");
      return;
    }
    router.refresh();
  }

  const noMainCategories = mainCategories.length === 0;

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className="h-12 px-5 text-base"
          onClick={openCreate}
          disabled={noMainCategories}
        >
          + New Sub Category
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

      {noMainCategories && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Create a Main Category first before adding sub-categories.
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="m-0 text-lg font-semibold text-slate-800">
            Sub Categories
          </h2>
          <span className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {filtered.length} of {subCategories.length} total
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-base">
            <thead>
              <tr className="bg-white text-slate-500">
                <th className="px-4 py-3 text-base font-semibold">Code</th>
                <th className="px-4 py-3 text-base font-semibold">Name</th>
                <th className="px-4 py-3 text-base font-semibold">
                  Main Category
                </th>
                <th className="px-4 py-3 text-base font-semibold">Linked</th>
                <th className="px-4 py-3 text-base font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((s) => (
                  <tr key={s.id} className="border-t border-slate-200">
                    <td className="px-4 py-3.5 text-slate-700">{s.code}</td>
                    <td className="px-4 py-3.5 text-slate-700">{s.name}</td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {s.mainCategoryName}{" "}
                      <span className="text-xs text-slate-400">
                        ({s.mainCategoryType === "PRODUCT" ? "Product" : "Service"})
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {s.productCount} products
                    </td>
                    <td className="px-4 py-3.5">
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
                    {subCategories.length === 0
                      ? "No sub-categories created yet."
                      : "No sub-categories match this filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={modal.mode !== "closed"}
        title={modal.mode === "edit" ? "Edit Sub Category" : "New Sub Category"}
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
              Main Category
            </label>
            <select
              value={mainCategoryId}
              onChange={(e) => setMainCategoryId(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
            >
              {mainCategories.map((mc) => (
                <option key={mc.id} value={mc.id}>
                  {mc.name} ({mc.type === "PRODUCT" ? "Product" : "Service"})
                </option>
              ))}
            </select>
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
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </form>
      </Modal>
    </section>
  );
}
