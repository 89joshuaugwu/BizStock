"use client";

import { useMemo, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { recordPurchase } from "@/lib/purchases";
import { formatNaira } from "@/lib/format";
import type { Product } from "@/types/product";

export function PurchaseForm({ products }: { products: Product[] }) {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId]
  );

  function selectProduct(id: string) {
    setProductId(id);
    const p = products.find((prod) => prod.id === id);
    if (p) {
      setCostPrice(p.costPrice.toString());
      setSupplier(p.supplier);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const qtyNum = Number(quantity);
    const costNum = Number(costPrice);

    if (!productId) {
      toast.error("Select a product.");
      return;
    }
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      toast.error("Enter a valid quantity.");
      return;
    }
    if (!Number.isFinite(costNum) || costNum < 0) {
      toast.error("Enter a valid cost price.");
      return;
    }
    if (!supplier.trim()) {
      toast.error("Supplier is required.");
      return;
    }

    setSaving(true);
    try {
      await recordPurchase({ productId, quantity: qtyNum, costPrice: costNum, supplier: supplier.trim() });
      toast.success(`${qtyNum} units added to ${selectedProduct?.name}.`);
      setProductId("");
      setQuantity("");
      setCostPrice("");
      setSupplier("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record purchase.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <Select
        label="Product"
        placeholder="Select a product"
        value={productId}
        onChange={(e) => selectProduct(e.target.value)}
        options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
      />

      {selectedProduct && (
        <p className="-mt-2 text-sm text-text-secondary">
          Currently {selectedProduct.stock} units in stock.
        </p>
      )}

      <Input
        label="Quantity received"
        type="number"
        min={1}
        required
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />
      <Input
        label="Cost price per unit (₦)"
        type="number"
        min={0}
        step="0.01"
        required
        value={costPrice}
        onChange={(e) => setCostPrice(e.target.value)}
      />
      <Input label="Supplier" required value={supplier} onChange={(e) => setSupplier(e.target.value)} />

      {quantity && costPrice && Number.isFinite(Number(quantity)) && Number.isFinite(Number(costPrice)) && (
        <p className="text-sm text-text-secondary">
          Total cost: <span className="font-semibold text-text-primary">{formatNaira(Number(quantity) * Number(costPrice))}</span>
        </p>
      )}

      <Button type="submit" loading={saving} disabled={products.length === 0}>
        Record purchase
      </Button>
    </form>
  );
}
