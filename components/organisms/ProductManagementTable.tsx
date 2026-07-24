"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import toast from "react-hot-toast";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ProductRowDesktop, ProductRowMobile } from "@/components/molecules/ProductRow";
import { deleteProduct } from "@/lib/products";
import type { Product } from "@/types/product";

interface ProductManagementTableProps {
  products: Product[];
  loading: boolean;
  canEdit: boolean;
}

export function ProductManagementTable({ products, loading, canEdit }: ProductManagementTableProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !category || p.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

  async function handleConfirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteProduct(toDelete.id);
      toast.success(`${toDelete.name} deleted.`);
      setToDelete(null);
    } catch {
      toast.error("Failed to delete product. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <Input
              placeholder="Search by name or SKU"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="All categories"
            options={categories.map((c) => ({ value: c, label: c }))}
            className="sm:max-w-[200px]"
          />
        </div>
        {canEdit && (
          <Link href="/dashboard/products/new">
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4" /> Add Product
            </Button>
          </Link>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 w-full animate-pulse rounded-lg bg-slate-200/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyProductsState hasProducts={products.length > 0} canEdit={canEdit} />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-border sm:block">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b border-border px-4 py-3 text-left font-semibold text-text-secondary">Name</th>
                  <th className="border-b border-border px-4 py-3 text-left font-semibold text-text-secondary">SKU</th>
                  <th className="border-b border-border px-4 py-3 text-left font-semibold text-text-secondary">Category</th>
                  <th className="border-b border-border px-4 py-3 text-right font-semibold text-text-secondary">Stock</th>
                  <th className="border-b border-border px-4 py-3 text-right font-semibold text-text-secondary">Price</th>
                  <th className="border-b border-border px-4 py-3 text-left font-semibold text-text-secondary">Status</th>
                  {canEdit && <th className="border-b border-border px-4 py-3 text-left font-semibold text-text-secondary">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <ProductRowDesktop key={product.id} product={product} canEdit={canEdit} onDelete={setToDelete} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 sm:hidden">
            {filtered.map((product) => (
              <ProductRowMobile key={product.id} product={product} canEdit={canEdit} onDelete={setToDelete} />
            ))}
          </div>
        </>
      )}

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Delete product?">
        <p className="text-sm text-text-secondary">
          This permanently removes <span className="font-medium text-text-primary">{toDelete?.name}</span> from
          your product list. Past sales and purchase records referencing it are not affected.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => setToDelete(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" fullWidth onClick={handleConfirmDelete} loading={deleting}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function EmptyProductsState({ hasProducts, canEdit }: { hasProducts: boolean; canEdit: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-border py-16 text-center">
      <p className="font-medium text-text-primary">
        {hasProducts ? "No products match your search" : "No products added yet"}
      </p>
      <p className="mt-1 text-sm text-text-secondary">
        {hasProducts
          ? "Try a different search term or clear the category filter."
          : canEdit
            ? "Add your first product to start tracking stock."
            : "Ask the business owner to add products."}
      </p>
      {!hasProducts && canEdit && (
        <Link href="/dashboard/products/new">
          <Button className="mt-4">
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </Link>
      )}
    </div>
  );
}
