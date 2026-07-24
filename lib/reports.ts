"use client";

import type { Product } from "@/types/product";
import type { Sale } from "@/types/sale";

export interface StockValuation {
  totalCostValue: number;
  totalRetailValue: number;
  totalUnits: number;
}

export function computeStockValuation(products: Product[]): StockValuation {
  return products.reduce(
    (acc, p) => ({
      totalCostValue: acc.totalCostValue + p.stock * p.costPrice,
      totalRetailValue: acc.totalRetailValue + p.stock * p.sellingPrice,
      totalUnits: acc.totalUnits + p.stock,
    }),
    { totalCostValue: 0, totalRetailValue: 0, totalUnits: 0 }
  );
}

export interface ProfitSummary {
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
}

/** Profit needs each sale line's cost basis — we look up the product's
 * CURRENT cost price as a reasonable approximation, since BizStock (like
 * the CONTEXT.md reference apps) doesn't do FIFO/weighted-average cost
 * lot tracking. This is called out in REPORTS.md for transparency. */
export function computeProfitSummary(sales: Sale[], productsById: Map<string, Product>): ProfitSummary {
  let revenue = 0;
  let cost = 0;

  for (const sale of sales) {
    for (const item of sale.items) {
      revenue += item.lineTotal;
      const product = productsById.get(item.productId);
      cost += (product?.costPrice ?? 0) * item.qty;
    }
  }

  const profit = revenue - cost;
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
  return { revenue, cost, profit, marginPct };
}

export interface BestSellerRow {
  productId: string;
  name: string;
  unitsSold: number;
  revenue: number;
}

export function computeBestSellers(sales: Sale[], topN = 8): BestSellerRow[] {
  const map = new Map<string, BestSellerRow>();

  for (const sale of sales) {
    for (const item of sale.items) {
      const existing = map.get(item.productId);
      if (existing) {
        existing.unitsSold += item.qty;
        existing.revenue += item.lineTotal;
      } else {
        map.set(item.productId, {
          productId: item.productId,
          name: item.name,
          unitsSold: item.qty,
          revenue: item.lineTotal,
        });
      }
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, topN);
}

export type ReportDateRange = "today" | "week" | "month" | "all";

export function filterSalesByRange(sales: Sale[], range: ReportDateRange): Sale[] {
  if (range === "all") return sales;

  const now = new Date();
  const start = new Date(now);

  if (range === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (range === "week") {
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
  } else if (range === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  return sales.filter((s) => {
    const date = s.createdAt?.toDate ? s.createdAt.toDate() : null;
    return date ? date >= start : false;
  });
}
