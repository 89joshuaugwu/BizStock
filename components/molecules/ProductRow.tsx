"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatNaira } from "@/lib/format";
import { getStockStatus, type Product } from "@/types/product";

interface ProductRowProps {
  product: Product;
  canEdit: boolean;
  onDelete?: (product: Product) => void;
}

export function ProductRowDesktop({ product, canEdit, onDelete }: ProductRowProps) {
  const status = getStockStatus(product);

  return (
    <tr className="border-b border-border last:border-0 hover:bg-slate-50/60">
      <td className="px-4 py-3">
        <Link href={`/dashboard/products/${product.id}`} className="font-medium text-text-primary hover:text-violet">
          {product.name}
        </Link>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-text-secondary">{product.sku}</td>
      <td className="px-4 py-3 text-text-secondary">{product.category}</td>
      <td className="px-4 py-3 text-right tabular-nums text-text-primary">{product.stock}</td>
      <td className="px-4 py-3 text-right tabular-nums text-text-primary">{formatNaira(product.sellingPrice)}</td>
      <td className="px-4 py-3">
        <StatusBadge status={status} />
      </td>
      {canEdit && (
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <Link
              href={`/dashboard/products/${product.id}`}
              aria-label={`Edit ${product.name}`}
              className="rounded-lg p-2 text-text-secondary hover:bg-violet-50 hover:text-violet"
            >
              <Pencil className="h-4 w-4" />
            </Link>
            <button
              onClick={() => onDelete?.(product)}
              aria-label={`Delete ${product.name}`}
              className="rounded-lg p-2 text-text-secondary hover:bg-error-50 hover:text-error"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

export function ProductRowMobile({ product, canEdit, onDelete }: ProductRowProps) {
  const status = getStockStatus(product);

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <Link href={`/dashboard/products/${product.id}`} className="font-semibold text-text-primary">
            {product.name}
          </Link>
          <p className="font-mono text-xs text-text-secondary">{product.sku}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-text-secondary">Category</dt>
        <dd className="text-right text-text-primary">{product.category}</dd>
        <dt className="text-text-secondary">Stock</dt>
        <dd className="text-right tabular-nums text-text-primary">{product.stock}</dd>
        <dt className="text-text-secondary">Price</dt>
        <dd className="text-right tabular-nums text-text-primary">{formatNaira(product.sellingPrice)}</dd>
      </dl>
      {canEdit && (
        <div className="mt-3 flex gap-2 border-t border-border pt-3">
          <Link
            href={`/dashboard/products/${product.id}`}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-medium text-text-primary"
          >
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <button
            onClick={() => onDelete?.(product)}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-error/20 bg-error-50 text-sm font-medium text-error"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
