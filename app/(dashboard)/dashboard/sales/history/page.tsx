"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { onSalesSnapshot } from "@/lib/sales";
import { formatNaira } from "@/lib/format";
import type { Sale } from "@/types/sale";

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSalesSnapshot(100, (data) => {
      setSales(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Sales History</h1>
        <p className="mt-1 text-sm text-text-secondary">Most recent 100 sales. Tap a row to see line items.</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 w-full animate-pulse rounded-lg bg-slate-200/60" />
          ))}
        </div>
      ) : sales.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium text-text-primary">No sales recorded yet</p>
          <p className="mt-1 text-sm text-text-secondary">Sales you complete will show up here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sales.map((sale) => {
            const isOpen = expanded === sale.id;
            const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : null;
            return (
              <div key={sale.id} className="overflow-hidden rounded-xl border border-border bg-white">
                <button
                  onClick={() => setExpanded(isOpen ? null : sale.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {date ? format(date, "d MMM yyyy, h:mm a") : "—"}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {sale.items.length} item{sale.items.length !== 1 ? "s" : ""} · Sold by {sale.soldByName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums font-semibold text-text-primary">{formatNaira(sale.total)}</span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-text-secondary" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-text-secondary" />
                    )}
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-border bg-slate-50/60 px-4 py-2">
                    {sale.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                        <span className="text-text-primary">
                          {item.name} <span className="text-text-secondary">× {item.qty}</span>
                        </span>
                        <span className="tabular-nums text-text-secondary">{formatNaira(item.lineTotal)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
