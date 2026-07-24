"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CartItem, type CartLine } from "@/components/molecules/CartItem";
import { checkoutSale } from "@/lib/sales";
import { formatNaira } from "@/lib/format";
import { getStockStatus, type Product } from "@/types/product";

export function SalesScreen({ products, loading }: { products: Product[]; loading: boolean }) {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [lastSaleTotal, setLastSaleTotal] = useState<number | null>(null);

  const filteredProducts = useMemo(() => {
    if (!search) return [];
    const term = search.toLowerCase();
    return products
      .filter((p) => p.stock > 0 && (p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)))
      .slice(0, 8);
  }, [products, search]);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        if (existing.qty >= product.stock) {
          toast.error(`Only ${product.stock} of ${product.name} in stock.`);
          return prev;
        }
        return prev.map((l) => (l.productId === product.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unitPrice: product.sellingPrice,
          qty: 1,
          availableStock: product.stock,
        },
      ];
    });
    setSearch("");
  }

  function increment(productId: string) {
    setCart((prev) =>
      prev.map((l) => {
        if (l.productId !== productId) return l;
        if (l.qty >= l.availableStock) {
          toast.error(`Only ${l.availableStock} available.`);
          return l;
        }
        return { ...l, qty: l.qty + 1 };
      })
    );
  }

  function decrement(productId: string) {
    setCart((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, qty: Math.max(1, l.qty - 1) } : l))
    );
  }

  function remove(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  const cartTotal = cart.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);

  async function handleCheckout() {
    if (cart.length === 0) return;
    setCheckingOut(true);
    try {
      const result = await checkoutSale({
        items: cart.map((l) => ({ productId: l.productId, qty: l.qty })),
      });
      setLastSaleTotal(result.total);
      toast.success("Sale completed!");
      setCart([]);
      setTimeout(() => setLastSaleTotal(null), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <Input
            placeholder="Search product by name or SKU to add to cart"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            disabled={loading}
          />
        </div>

        {filteredProducts.length > 0 && (
          <div className="mt-2 divide-y divide-border rounded-xl border border-border bg-white">
            {filteredProducts.map((product) => {
              const status = getStockStatus(product);
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-text-primary">{product.name}</p>
                    <p className="text-xs text-text-secondary">
                      {product.sku} · {product.stock} in stock
                      {status === "low-stock" && " · Low"}
                    </p>
                  </div>
                  <p className="tabular-nums font-semibold text-text-primary">{formatNaira(product.sellingPrice)}</p>
                </button>
              );
            })}
          </div>
        )}

        {search && filteredProducts.length === 0 && (
          <p className="mt-3 text-sm text-text-secondary">No in-stock products match &ldquo;{search}&rdquo;.</p>
        )}

        {!search && (
          <p className="mt-4 text-sm text-text-secondary">
            Start typing a product name or SKU above to add it to the cart.
          </p>
        )}
      </div>

      {/* Cart — sticky bottom sheet on mobile per DESIGN.md Section 4 */}
      <div className="fixed inset-x-0 bottom-16 z-10 border-t border-border bg-white p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] lg:static lg:z-auto lg:rounded-xl lg:border lg:p-5 lg:shadow-sm">
        <h2 className="mb-1 font-bold text-text-primary">Cart</h2>

        {cart.length === 0 ? (
          <p className="py-4 text-sm text-text-secondary">No items yet. Search above to add products.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto scrollbar-thin">
            {cart.map((line) => (
              <CartItem key={line.productId} line={line} onIncrement={increment} onDecrement={decrement} onRemove={remove} />
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="font-medium text-text-primary">Total</span>
          <motion.span
            key={cartTotal}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            className="animate-count-up text-lg font-bold tabular-nums text-text-primary"
          >
            {formatNaira(cartTotal)}
          </motion.span>
        </div>

        <Button
          fullWidth
          size="lg"
          className="mt-3"
          disabled={cart.length === 0}
          loading={checkingOut}
          onClick={handleCheckout}
        >
          Complete Sale
        </Button>

        <AnimatePresence>
          {lastSaleTotal !== null && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 flex items-center gap-2 rounded-lg bg-success-50 px-3 py-2 text-sm font-medium text-success"
            >
              <CheckCircle2 className="h-4 w-4" /> Sale of {formatNaira(lastSaleTotal)} completed
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
