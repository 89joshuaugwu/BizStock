"use client";

import { useEffect, useState } from "react";
import { SalesScreen } from "@/components/organisms/SalesScreen";
import { useAuth } from "@/components/providers/AuthProvider";
import { onProductsSnapshot } from "@/lib/products";
import type { Product } from "@/types/product";

export default function SalesPage() {
  const { businessId } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    const unsub = onProductsSnapshot(businessId, (data) => {
      setProducts(data);
      setLoading(false);
    });
    return () => unsub();
  }, [businessId]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">New Sale</h1>
        <p className="mt-1 text-sm text-text-secondary">Search a product to add it to the cart, then complete the sale.</p>
      </div>
      <SalesScreen products={products} loading={loading} />
    </div>
  );
}
