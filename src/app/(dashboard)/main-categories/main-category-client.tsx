"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { CategoryType, MainCategoryDTO } from "@/types/product";

type CategoryTypeFilter = "all" | CategoryType;

type MainCategoryClientProps = {
  mainCategories: MainCategoryDTO[];
};

type ModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; category: MainCategoryDTO };

export function MainCategoryClient({
  mainCategories,
}: MainCategoryClientProps) {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<CategoryTypeFilter>("all");
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("PRODUCT");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredMainCategories =
    selectedType === "all"
      ? mainCategories
      : mainCategories.filter((category) => category.type === selectedType);

  function openCreate() {
    setName("");
    setType("PRODUCT");
    setError("");
    setModal({ mode: "create" });
  }

  function openEdit(category: MainCategoryDTO) {
    setName(category.name);
    setType(category.type);
    setError("");
    setModal({ mode: "edit", category });
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
        ? `/api/main-categories/${modal.category.id}`
        : "/api/main-categories";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type }),
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

  async function handleDelete(category: MainCategoryDTO) {
    if (!confirm(`Delete main category "${category.name}"?`)) return;
    const res = await fetch(`/api/main-categories/${category.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Could not delete this main category.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className="h-12 px-5 text-base"
          onClick={openCreate}
        >
          + New Main Category
        </Button>

        <select
          value={selectedType}
          onChange={(event) =>
            setSelectedType(event.target.value as CategoryTypeFilter)
          }
          className="h-10 min-w-36 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
          aria-label="Filter main categories by type"
        >
          <option value="all">All Types</option>
          <option value="PRODUCT">Product</option>
          <option value="SERVICE">Service</option>
        </select>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="m-0 text-lg font-semibold text-slate-800">
            Main Categories
          </h2>
          <span className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {filteredMainCategories.length} of {mainCategories.length} total
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-base">
            <thead>
              <tr className="bg-white text-slate-500">
                <th className="px-4 py-3 text-base font-semibold">Code</th>
                <th className="px-4 py-3 text-base font-semibold">Name</th>
                <th className="px-4 py-3 text-base font-semibold">Type</th>
                <th className="px-4 py-3 text-base font-semibold">Linked</th>
                <th className="px-4 py-3 text-base font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMainCategories.length > 0 ? (
                filteredMainCategories.map((category) => (
                  <tr key={category.id} className="border-t border-slate-200">
                    <td className="px-4 py-3.5 text-slate-700">
                      {category.code}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {category.name}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {category.type === "PRODUCT" ? "Product" : "Service"}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {category.subCategoryCount} sub · {category.productCount}{" "}
                      products
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => openEdit(category)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => handleDelete(category)}
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
                    {mainCategories.length === 0
                      ? "No main categories created yet."
                      : "No categories match this filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={modal.mode !== "closed"}
        title={modal.mode === "edit" ? "Edit Main Category" : "New Main Category"}
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
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CategoryType)}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
            >
              <option value="PRODUCT">Product</option>
              <option value="SERVICE">Service</option>
            </select>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </form>
      </Modal>
    </section>
  );
}
