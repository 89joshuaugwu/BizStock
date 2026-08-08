"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Package, TrendingUp, Wallet } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { useAuth } from "@/components/providers/AuthProvider";
import { onProductsSnapshot } from "@/lib/products";
import { onSalesSnapshot } from "@/lib/sales";
import {
  computeBestSellers,
  computeProfitSummary,
  computeStockValuation,
  filterSalesByRange,
  type ReportDateRange,
} from "@/lib/reports";
import { formatNaira, formatNumber } from "@/lib/format";
import type { Product } from "@/types/product";
import type { Sale } from "@/types/sale";

const RANGE_OPTIONS: { value: ReportDateRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

export function ReportsDashboard() {
  const { businessId } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<ReportDateRange>("month");

  useEffect(() => {
    if (!businessId) return;

    let productsLoaded = false;
    let salesLoaded = false;

    const unsubProducts = onProductsSnapshot(businessId, (data) => {
      setProducts(data);
      productsLoaded = true;
      if (salesLoaded) setLoading(false);
    });
    // Bounded to the last 500 sales to keep report reads predictable on
    // the Spark plan — plenty for a small business's rolling reporting.
    const unsubSales = onSalesSnapshot(businessId, 500, (data) => {
      setSales(data);
      salesLoaded = true;
      if (productsLoaded) setLoading(false);
    });

    return () => {
      unsubProducts();
      unsubSales();
    };
  }, [businessId]);

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const rangedSales = useMemo(() => filterSalesByRange(sales, range), [sales, range]);

  const valuation = useMemo(() => computeStockValuation(products), [products]);
  const profit = useMemo(() => computeProfitSummary(rangedSales, productsById), [rangedSales, productsById]);
  const bestSellers = useMemo(() => computeBestSellers(rangedSales), [rangedSales]);

  if (loading) return <FullPageSpinner />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
          <p className="mt-1 text-sm text-text-secondary">Profit and best sellers reflect the selected period.</p>
        </div>
        <Select
          value={range}
          onChange={(e) => setRange(e.target.value as ReportDateRange)}
          options={RANGE_OPTIONS}
          className="w-40"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-2 text-text-secondary">
            <Wallet className="h-4 w-4" />
            <span className="text-sm">Stock value (cost)</span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-text-primary">
            {formatNaira(valuation.totalCostValue)}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Retail value {formatNaira(valuation.totalRetailValue)} · {formatNumber(valuation.totalUnits)} units
          </p>
        </Card>

        <Card>
          <div className="flex items-center gap-2 text-text-secondary">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Profit ({RANGE_OPTIONS.find((r) => r.value === range)?.label.toLowerCase()})</span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-success">{formatNaira(profit.profit)}</p>
          <p className="mt-1 text-xs text-text-secondary">
            {profit.marginPct.toFixed(1)}% margin on {formatNaira(profit.revenue)} revenue
          </p>
        </Card>

        <Card>
          <div className="flex items-center gap-2 text-text-secondary">
            <Package className="h-4 w-4" />
            <span className="text-sm">Units sold ({RANGE_OPTIONS.find((r) => r.value === range)?.label.toLowerCase()})</span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-text-primary">
            {formatNumber(rangedSales.reduce((sum, s) => sum + s.items.reduce((n, i) => n + i.qty, 0), 0))}
          </p>
          <p className="mt-1 text-xs text-text-secondary">{formatNumber(rangedSales.length)} sales completed</p>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Best sellers</CardTitle>
        </CardHeader>
        {bestSellers.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-secondary">No sales in this period yet.</p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bestSellers} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 12, fill: "#64748B" }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fontSize: 12, fill: "#0F172A" }}
                  tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 18)}…` : v)}
                />
                <Tooltip
                  formatter={(value, key) => {
                    const numeric = typeof value === "number" ? value : Number(value ?? 0);
                    return [key === "unitsSold" ? `${numeric} units` : formatNaira(numeric), key === "unitsSold" ? "Sold" : "Revenue"];
                  }}
                  contentStyle={{ borderRadius: 8, borderColor: "#E2E8F0", fontSize: 13 }}
                />
                <Bar dataKey="unitsSold" fill="#7C3AED" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
