"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { OwnerOnlyGuard } from "@/components/shells/OwnerOnlyGuard";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { onPurchasesSnapshot } from "@/lib/purchases";
import { formatNaira } from "@/lib/format";
import type { Purchase } from "@/types/purchase";

export default function PurchaseHistoryPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onPurchasesSnapshot(100, (data) => {
      setPurchases(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const columns: DataTableColumn<Purchase>[] = [
    {
      key: "date",
      header: "Date",
      sortValue: (p) => p.createdAt?.toMillis?.() ?? 0,
      render: (p) => (p.createdAt?.toDate ? format(p.createdAt.toDate(), "d MMM yyyy, h:mm a") : "—"),
    },
    {
      key: "product",
      header: "Product",
      sortValue: (p) => p.productName ?? "",
      render: (p) => p.productName ?? p.productId,
    },
    { key: "quantity", header: "Qty", numeric: true, sortValue: (p) => p.quantity, render: (p) => p.quantity },
    {
      key: "costPrice",
      header: "Unit cost",
      numeric: true,
      sortValue: (p) => p.costPrice,
      render: (p) => formatNaira(p.costPrice),
    },
    {
      key: "totalCost",
      header: "Total",
      numeric: true,
      sortValue: (p) => p.totalCost,
      render: (p) => formatNaira(p.totalCost),
    },
    { key: "supplier", header: "Supplier", sortValue: (p) => p.supplier, render: (p) => p.supplier, hideOnMobile: true },
    { key: "recordedBy", header: "Recorded by", render: (p) => p.recordedByName, hideOnMobile: true },
  ];

  return (
    <OwnerOnlyGuard>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Purchase History</h1>
          <p className="mt-1 text-sm text-text-secondary">Most recent 100 purchases.</p>
        </div>
        <DataTable
          columns={columns}
          rows={purchases}
          rowKey={(p) => p.id}
          loading={loading}
          mobileCardTitle={(p) => p.productName ?? p.productId}
          emptyState={
            <div>
              <p className="font-medium text-text-primary">No purchases recorded yet</p>
              <p className="mt-1 text-sm text-text-secondary">Stock you receive from suppliers will show up here.</p>
            </div>
          }
        />
      </div>
    </OwnerOnlyGuard>
  );
}
