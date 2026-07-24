"use client";

import { useEffect, useState } from "react";
import { SalesScreen } from "@/components/organisms/SalesScreen";
import { onProductsSnapshot } from "@/lib/products";
import type { Product } from "@/types/product";

export default function SalesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onProductsSnapshot((data) => {
      setProducts(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

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
