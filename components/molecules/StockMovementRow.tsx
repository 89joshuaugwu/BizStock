import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { format } from "date-fns";
import { formatNaira } from "@/lib/format";
import type { StockMovement } from "@/types/movement";

export function StockMovementRow({ movement }: { movement: StockMovement }) {
  const isPurchase = movement.type === "purchase";
  const date = movement.createdAt?.toDate ? movement.createdAt.toDate() : null;

  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-0">
      {isPurchase ? (
        <ArrowUpCircle className="h-5 w-5 shrink-0 text-success" />
      ) : (
        <ArrowDownCircle className="h-5 w-5 shrink-0 text-violet" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">
          {movement.productName ?? movement.productId}
        </p>
        <p className="text-xs text-text-secondary">
          {isPurchase ? "Stock in" : "Stock out"} · {date ? format(date, "d MMM yyyy, h:mm a") : "—"}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold tabular-nums text-text-primary">
          {isPurchase ? "+" : "-"}
          {movement.quantity}
        </p>
        <p className="text-xs tabular-nums text-text-secondary">{formatNaira(movement.totalValue)}</p>
      </div>
    </div>
  );
}
