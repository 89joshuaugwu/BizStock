/** Nigerian Naira formatting, used everywhere money is shown — always
 * paired with tabular-nums in the markup per DESIGN.md Section 1. */
export function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-NG").format(n);
}
