"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, PackageX, PlusCircle, ShoppingCart, Truck } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StockMovementRow } from "@/components/molecules/StockMovementRow";
import { useAuth } from "@/components/providers/AuthProvider";
import { onProductsSnapshot } from "@/lib/products";
import { onRecentMovementsSnapshot } from "@/lib/movements";
import { onSalesSnapshot } from "@/lib/sales";
import { getStockStatus, type Product } from "@/types/product";
import type { StockMovement } from "@/types/movement";
import type { Sale } from "@/types/sale";
import { formatNaira, formatNumber } from "@/lib/format";

export default function DashboardHomePage() {
  const { appUser, isOwner } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);

  useEffect(() => {
    const unsub = onProductsSnapshot(setProducts);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isOwner) return;
    const unsub = onRecentMovementsSnapshot(8, setMovements);
    return () => unsub();
  }, [isOwner]);

  useEffect(() => {
    const unsub = onSalesSnapshot(8, setRecentSales);
    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    const lowStock = products.filter((p) => getStockStatus(p) === "low-stock").length;
    const outOfStock = products.filter((p) => getStockStatus(p) === "out-of-stock").length;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todaySales = recentSales.filter((s) => {
      const date = s.createdAt?.toDate ? s.createdAt.toDate() : null;
      return date ? date >= startOfToday : false;
    });
    const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);

    return { totalProducts: products.length, lowStock, outOfStock, todayTotal, todayCount: todaySales.length };
  }, [products, recentSales]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          Welcome back{appUser?.displayName ? `, ${appUser.displayName.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">Here&apos;s what&apos;s happening in your shop today.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total products" value={formatNumber(stats.totalProducts)} />
        <StatCard
          label="Low stock"
          value={formatNumber(stats.lowStock)}
          tone={stats.lowStock > 0 ? "warning" : "default"}
          icon={AlertTriangle}
        />
        <StatCard
          label="Out of stock"
          value={formatNumber(stats.outOfStock)}
          tone={stats.outOfStock > 0 ? "error" : "default"}
          icon={PackageX}
        />
        <StatCard label="Today's sales" value={formatNaira(stats.todayTotal)} hint={`${stats.todayCount} sale${stats.todayCount !== 1 ? "s" : ""}`} />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/dashboard/sales"
          className="flex h-11 items-center gap-2 rounded-lg bg-violet px-4 text-sm font-medium text-white hover:bg-violet-dark"
        >
          <ShoppingCart className="h-4 w-4" /> New Sale
        </Link>
        {isOwner && (
          <>
            <Link
              href="/dashboard/products/new"
              className="flex h-11 items-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-medium text-text-primary hover:bg-slate-50"
            >
              <PlusCircle className="h-4 w-4" /> Add Product
            </Link>
            <Link
              href="/dashboard/purchases"
              className="flex h-11 items-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-medium text-text-primary hover:bg-slate-50"
            >
              <Truck className="h-4 w-4" /> Record Purchase
            </Link>
          </>
        )}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        {isOwner ? (
          movements.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-secondary">No stock activity yet.</p>
          ) : (
            <div>
              {movements.map((m) => (
                <StockMovementRow key={m.id} movement={m} />
              ))}
            </div>
          )
        ) : recentSales.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-secondary">No sales recorded yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {recentSales.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-text-primary">
                  {s.items.length} item{s.items.length !== 1 ? "s" : ""} sold
                </span>
                <span className="tabular-nums font-medium text-text-primary">{formatNaira(s.total)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warning" | "error";
  icon?: typeof AlertTriangle;
}) {
  const toneClasses = {
    default: "text-text-primary",
    warning: "text-warning",
    error: "text-error",
  }[tone];

  return (
    <Card>
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">{label}</span>
        {Icon && <Icon className={`h-4 w-4 ${toneClasses}`} />}
      </div>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${toneClasses}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-text-secondary">{hint}</p>}
    </Card>
  );
}
