import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import type { StockStatus } from "@/types/product";

const config: Record<StockStatus, { label: string; classes: string; Icon: typeof CheckCircle2; pulse?: boolean }> = {
  "in-stock": {
    label: "In Stock",
    classes: "bg-success-50 text-success border-success/20",
    Icon: CheckCircle2,
  },
  "low-stock": {
    label: "Low Stock",
    classes: "bg-warning-50 text-warning border-warning/20",
    Icon: AlertTriangle,
    pulse: true,
  },
  "out-of-stock": {
    label: "Out of Stock",
    classes: "bg-error-50 text-error border-error/20",
    Icon: XCircle,
  },
};

export function StatusBadge({ status }: { status: StockStatus }) {
  const { label, classes, Icon, pulse } = config[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        classes,
        pulse && "animate-pulse-badge"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
