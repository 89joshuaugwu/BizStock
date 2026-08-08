"use client";

import { useEffect, useState } from "react";
import { ProductManagementTable } from "@/components/organisms/ProductManagementTable";
import { useAuth } from "@/components/providers/AuthProvider";
import { onProductsSnapshot } from "@/lib/products";
import type { Product } from "@/types/product";

export default function ProductsPage() {
  const { isOwner, businessId } = useAuth();
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
        <h1 className="text-2xl font-bold text-text-primary">Products</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {isOwner ? "Manage your product catalog and stock levels." : "View current stock levels and prices."}
        </p>
      </div>
      <ProductManagementTable products={products} loading={loading} canEdit={isOwner} />
    </div>
  );
}
