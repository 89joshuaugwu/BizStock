"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createProduct, updateProduct } from "@/lib/products";
import { uploadImage } from "@/lib/cloudinary";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Product, ProductInput } from "@/types/product";

interface ProductFormProps {
  product?: Product;
}

type FormState = {
  name: string;
  sku: string;
  category: string;
  costPrice: string;
  sellingPrice: string;
  stock: string;
  reorderThreshold: string;
  supplier: string;
};

function toFormState(product?: Product, defaultReorderThreshold?: number): FormState {
  return {
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    category: product?.category ?? "",
    costPrice: product?.costPrice?.toString() ?? "",
    sellingPrice: product?.sellingPrice?.toString() ?? "",
    stock: product?.stock?.toString() ?? "0",
    reorderThreshold: product?.reorderThreshold?.toString() ?? defaultReorderThreshold?.toString() ?? "10",
    supplier: product?.supplier ?? "",
  };
}

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter();
  const { business, businessId } = useAuth();
  const isEdit = !!product;
  const [form, setForm] = useState<FormState>(() => toFormState(product, business?.defaultReorderThreshold));
  const [imageUrl, setImageUrl] = useState<string | null>(product?.imageUrl ?? null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const url = await uploadImage(file);
      setImageUrl(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const costPrice = Number(form.costPrice);
    const sellingPrice = Number(form.sellingPrice);
    const stock = Number(form.stock);
    const reorderThreshold = Number(form.reorderThreshold);

    if (!form.name.trim() || !form.sku.trim() || !form.category.trim() || !form.supplier.trim()) {
      toast.error("Please fill in all fields.");
      return;
    }
    if ([costPrice, sellingPrice, stock, reorderThreshold].some((n) => !Number.isFinite(n) || n < 0)) {
      toast.error("Prices, stock, and threshold must be valid, non-negative numbers.");
      return;
    }

    if (!isEdit && !businessId) {
      toast.error("Still loading your business — try again in a moment.");
      return;
    }

    const commonFields = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      category: form.category.trim(),
      costPrice,
      sellingPrice,
      stock,
      reorderThreshold,
      supplier: form.supplier.trim(),
      imageUrl,
    };

    setSaving(true);
    try {
      if (isEdit) {
        // businessId is intentionally omitted from update payloads — it
        // never changes after creation, and the update rule re-checks it
        // stays equal to the existing value regardless.
        await updateProduct(product.id, commonFields);
        toast.success("Product updated.");
      } else {
        const input: ProductInput = { ...commonFields, businessId: businessId as string };
        await createProduct(input);
        toast.success("Product added.");
      }
      router.push("/dashboard/products");
    } catch {
      toast.error("Failed to save product. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-text-primary">Product photo (optional)</label>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-slate-50">
            {uploadingImage ? (
              <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
            ) : imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Product" className="h-full w-full object-cover" />
            ) : (
              <ImagePlus className="h-6 w-6 text-text-secondary" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex h-10 cursor-pointer items-center rounded-lg border border-border bg-white px-3 text-sm font-medium text-text-primary hover:bg-slate-50">
              {imageUrl ? "Replace photo" : "Upload photo"}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} disabled={uploadingImage} />
            </label>
            {imageUrl && (
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary hover:bg-error-50 hover:text-error"
                aria-label="Remove photo"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Product name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
        <Input
          label="SKU"
          required
          value={form.sku}
          onChange={(e) => set("sku", e.target.value)}
          className="font-mono"
          hint="A short unique code, e.g. RIC-50KG"
        />
        <Input label="Category" required value={form.category} onChange={(e) => set("category", e.target.value)} />
        <Input label="Supplier" required value={form.supplier} onChange={(e) => set("supplier", e.target.value)} />
        <Input
          label="Cost price (₦)"
          type="number"
          min={0}
          step="0.01"
          required
          value={form.costPrice}
          onChange={(e) => set("costPrice", e.target.value)}
        />
        <Input
          label="Selling price (₦)"
          type="number"
          min={0}
          step="0.01"
          required
          value={form.sellingPrice}
          onChange={(e) => set("sellingPrice", e.target.value)}
        />
        <Input
          label={isEdit ? "Stock quantity" : "Initial stock"}
          type="number"
          min={0}
          required
          value={form.stock}
          onChange={(e) => set("stock", e.target.value)}
          hint={isEdit ? "Adjust here for corrections — sales and purchases update this automatically." : undefined}
        />
        <Input
          label="Reorder threshold"
          type="number"
          min={0}
          required
          value={form.reorderThreshold}
          onChange={(e) => set("reorderThreshold", e.target.value)}
          hint="You'll be alerted when stock falls to or below this number."
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {isEdit ? "Save changes" : "Add product"}
        </Button>
      </div>
    </form>
  );
}
