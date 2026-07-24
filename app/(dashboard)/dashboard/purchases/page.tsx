"use client";

import { useEffect, useState } from "react";
import { OwnerOnlyGuard } from "@/components/shells/OwnerOnlyGuard";
import { PurchaseForm } from "@/components/organisms/PurchaseForm";
import { onProductsSnapshot } from "@/lib/products";
import type { Product } from "@/types/product";

export default function PurchasesPage() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const unsub = onProductsSnapshot(setProducts);
    return () => unsub();
  }, []);

  return (
    <OwnerOnlyGuard>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Record Purchase</h1>
          <p className="mt-1 text-sm text-text-secondary">Add stock received from a supplier.</p>
        </div>
        {products.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Add a product first before recording a purchase.
          </p>
        ) : (
          <PurchaseForm products={products} />
        )}
      </div>
    </OwnerOnlyGuard>
  );
}
