"use client";

import { Minus, Plus, X } from "lucide-react";
import { formatNaira } from "@/lib/format";

export interface CartLine {
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  qty: number;
  availableStock: number;
}

interface CartItemProps {
  line: CartLine;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onRemove: (productId: string) => void;
}

export function CartItem({ line, onIncrement, onDecrement, onRemove }: CartItemProps) {
  const lineTotal = line.qty * line.unitPrice;
  const atMax = line.qty >= line.availableStock;

  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-text-primary">{line.name}</p>
        <p className="font-mono text-xs text-text-secondary">{line.sku}</p>
      </div>

      <div className="flex items-center gap-1.5 rounded-lg border border-border">
        <button
          onClick={() => onDecrement(line.productId)}
          aria-label={`Decrease quantity of ${line.name}`}
          className="flex h-9 w-9 items-center justify-center text-text-secondary hover:text-violet"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-6 text-center text-sm tabular-nums text-text-primary">{line.qty}</span>
        <button
          onClick={() => onIncrement(line.productId)}
          disabled={atMax}
          aria-label={`Increase quantity of ${line.name}`}
          className="flex h-9 w-9 items-center justify-center text-text-secondary hover:text-violet disabled:opacity-30"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="w-24 text-right text-sm font-semibold tabular-nums text-text-primary">
        {formatNaira(lineTotal)}
      </p>

      <button
        onClick={() => onRemove(line.productId)}
        aria-label={`Remove ${line.name} from cart`}
        className="rounded-lg p-1.5 text-text-secondary hover:bg-error-50 hover:text-error"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
