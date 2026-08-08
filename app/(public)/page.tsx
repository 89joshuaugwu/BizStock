import Link from "next/link";
import {
  ArrowRight,
  Bell,
  LineChart,
  Package,
  ScanBarcode,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { getWhatsAppLink } from "@/lib/config";
import { getPlatformConfigServer } from "@/lib/platform-config";

const features = [
  {
    icon: Package,
    title: "Products at a glance",
    body: "Every SKU, category, cost, and stock count in one searchable table — with a status badge that never leaves you guessing.",
  },
  {
    icon: ShoppingCart,
    title: "POS-lite sales screen",
    body: "Search, tap, checkout. Stock deducts the instant a sale completes — no manual recount at closing time.",
  },
  {
    icon: Bell,
    title: "Low-stock alerts",
    body: "Set a reorder threshold per product and get notified the moment something runs low, before it runs out.",
  },
  {
    icon: LineChart,
    title: "Reports that matter",
    body: "Stock valuation, profit margin, and best sellers — the three numbers that actually run a small business.",
  },
  {
    icon: ShieldCheck,
    title: "Owner + staff roles",
    body: "Staff record sales at the counter. Only the owner edits products, records purchases, and sees reports.",
  },
  {
    icon: ScanBarcode,
    title: "Built for the counter",
    body: "Mobile-friendly for staff on the shop floor, desktop-capable for back-office work — same app, both jobs.",
  },
];

export default async function LandingPage() {
  const config = await getPlatformConfigServer();
  const whatsappLink = getWhatsAppLink(config.whatsappNumber, config.whatsappMessage);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:items-center lg:py-28">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet/20 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-dark">
              Inventory management, no spreadsheet required
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
              Know your stock.
              <br />
              <span className="text-violet">Every unit, every naira.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-text-secondary">
              BizStock tracks products, purchases, and sales for your small business —
              so you always know what&apos;s selling, what&apos;s low, and what it&apos;s
              worth.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 items-center gap-2 rounded-lg bg-violet px-6 text-sm font-semibold text-white hover:bg-violet-dark"
              >
                Set up your business <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/auth/login"
                className="flex h-12 items-center rounded-lg border border-border bg-white px-6 text-sm font-semibold text-text-primary hover:bg-slate-50"
              >
                Log in
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <div className="rounded-2xl border border-border bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <Logo size={28} />
                <span className="rounded-full bg-warning-50 px-2.5 py-1 text-xs font-medium text-warning">
                  4 low stock
                </span>
              </div>
              <div className="space-y-2.5">
                {[
                  { name: "Rice — 50kg bag", stock: 3, status: "Low" },
                  { name: "Cooking Oil 5L", stock: 18, status: "In stock" },
                  { name: "Detergent 1kg", stock: 0, status: "Out" },
                ].map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"
                  >
                    <span className="text-text-primary">{row.name}</span>
                    <span className="tabular-nums text-text-secondary">{row.stock} units</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -bottom-4 -left-4 -z-10 h-full w-full rounded-2xl bg-violet-100" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-xl">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary">
            Everything a shop counter actually needs
          </h2>
          <p className="mt-3 text-text-secondary">
            No modules you&apos;ll never touch. Just the parts of running a shop that
            matter: what you have, what you sold, and what to reorder.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-white p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50">
                <Icon className="h-5 w-5 text-violet" />
              </div>
              <h3 className="font-semibold text-text-primary">{title}</h3>
              <p className="mt-1.5 text-sm text-text-secondary">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-violet-50/60">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary">
            Get your business set up
          </h2>
          <p className="mx-auto mt-3 max-w-md text-text-secondary">
            Message us and we&apos;ll set up your dashboard — one owner account, unlimited staff, branded to your business.
          </p>
          <Link
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex h-12 items-center gap-2 rounded-lg bg-violet px-7 text-sm font-semibold text-white hover:bg-violet-dark"
          >
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
