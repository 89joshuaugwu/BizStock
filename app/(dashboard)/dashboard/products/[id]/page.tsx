"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductForm } from "@/components/organisms/ProductForm";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StockMovementRow } from "@/components/molecules/StockMovementRow";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { useAuth } from "@/components/providers/AuthProvider";
import { onProductSnapshot } from "@/lib/products";
import { onProductMovementsSnapshot } from "@/lib/movements";
import { getStockStatus, type Product } from "@/types/product";
import type { StockMovement } from "@/types/movement";
import { formatNaira } from "@/lib/format";

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isOwner } = useAuth();
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  useEffect(() => {
    const unsub = onProductSnapshot(id, setProduct);
    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (!isOwner) return;
    const unsub = onProductMovementsSnapshot(id, setMovements);
    return () => unsub();
  }, [id, isOwner]);

  if (product === undefined) return <FullPageSpinner />;

  if (product === null) {
    return (
      <div className="py-16 text-center">
        <p className="font-medium text-text-primary">Product not found</p>
        <Link href="/dashboard/products" className="mt-2 inline-block text-sm text-violet hover:underline">
          Back to products
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/dashboard/products"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to products
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-text-primary">{product.name}</h1>
        <StatusBadge status={getStockStatus(product)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isOwner ? (
            <ProductForm product={product} />
          ) : (
            <ReadOnlyProductDetails product={product} />
          )}
        </div>

        {isOwner && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Stock history</CardTitle>
            </CardHeader>
            {movements.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-secondary">No movements recorded yet.</p>
            ) : (
              <div className="max-h-[480px] overflow-y-auto scrollbar-thin">
                {movements.map((m) => (
                  <StockMovementRow key={m.id} movement={m} />
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function ReadOnlyProductDetails({ product }: { product: Product }) {
  const rows: [string, string][] = [
    ["SKU", product.sku],
    ["Category", product.category],
    ["Supplier", product.supplier],
    ["Selling price", formatNaira(product.sellingPrice)],
    ["Stock", `${product.stock} units`],
    ["Reorder threshold", `${product.reorderThreshold} units`],
  ];

  return (
    <Card>
      <dl className="divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between py-3 text-sm first:pt-0 last:pb-0">
            <dt className="text-text-secondary">{label}</dt>
            <dd className="font-medium text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
