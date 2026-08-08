"use client";

import { useEffect, useState } from "react";
import { OwnerOnlyGuard } from "@/components/shells/OwnerOnlyGuard";
import { useAuth } from "@/components/providers/AuthProvider";
import { PurchaseForm } from "@/components/organisms/PurchaseForm";
import { onProductsSnapshot } from "@/lib/products";
import type { Product } from "@/types/product";

export default function PurchasesPage() {
  const { businessId } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!businessId) return;
    const unsub = onProductsSnapshot(businessId, setProducts);
    return () => unsub();
  }, [businessId]);

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
