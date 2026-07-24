"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  History,
  Truck,
  BarChart3,
  Users,
  Settings as SettingsIcon,
  MoreHorizontal,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { AlertBell } from "@/components/molecules/AlertBell";
import { useAuth } from "@/components/providers/AuthProvider";
import { logout } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/ui/Modal";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  ownerOrAdminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/products", label: "Products", icon: Package },
  { href: "/dashboard/sales", label: "New Sale", icon: ShoppingCart },
  { href: "/dashboard/sales/history", label: "Sales History", icon: History },
  { href: "/dashboard/purchases", label: "Purchases", icon: Truck, ownerOrAdminOnly: true },
  { href: "/dashboard/purchases/history", label: "Purchase History", icon: History, ownerOrAdminOnly: true },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3, ownerOrAdminOnly: true },
  { href: "/dashboard/staff", label: "Staff", icon: Users, ownerOrAdminOnly: true },
  { href: "/dashboard/settings", label: "Settings", icon: SettingsIcon, ownerOrAdminOnly: true },
];

const MOBILE_TAB_COUNT = 4;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { appUser, business, isOwnerOrAdmin } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const items = NAV_ITEMS.filter((item) => !item.ownerOrAdminOnly || isOwnerOrAdmin);
  const mobileTabs = items.slice(0, MOBILE_TAB_COUNT);
  const mobileMore = items.slice(MOBILE_TAB_COUNT);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleLogout() {
    await logout();
    router.push("/auth/login");
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-white">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link href="/dashboard">
              <Logo size={28} />
            </Link>
            {business && (
              <span className="hidden text-sm text-text-secondary md:inline">{business.name}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <AlertBell />
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex h-11 items-center gap-2 rounded-lg px-2 hover:bg-slate-100"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-dark">
                  {appUser?.displayName?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-medium text-text-primary">{appUser?.displayName}</p>
                  <p className="text-xs capitalize text-text-secondary">{appUser?.role}</p>
                </div>
                <ChevronDown className="hidden h-4 w-4 text-text-secondary sm:block" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-12 w-48 rounded-xl border border-border bg-white py-1.5 shadow-lg">
                  <div className="border-b border-border px-3 pb-2">
                    <p className="truncate text-sm font-medium text-text-primary">{appUser?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-error hover:bg-error-50"
                  >
                    <LogOut className="h-4 w-4" /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 border-r border-border bg-white p-3 lg:block">
          <nav className="space-y-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-violet-50 text-violet"
                    : "text-text-secondary hover:bg-slate-100 hover:text-text-primary"
                )}
              >
                <item.icon className="h-4.5 w-4.5" />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Page content */}
        <main className="min-w-0 flex-1 px-4 py-6 pb-24 sm:px-6 lg:pb-6">{children}</main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-white lg:hidden">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${mobileMore.length ? MOBILE_TAB_COUNT + 1 : mobileTabs.length}, 1fr)` }}>
          {mobileTabs.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
                isActive(item.href) ? "text-violet" : "text-text-secondary"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
          {mobileMore.length > 0 && (
            <button
              onClick={() => setMoreOpen(true)}
              className="flex min-h-12 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-text-secondary"
            >
              <MoreHorizontal className="h-5 w-5" />
              More
            </button>
          )}
        </div>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <div className="space-y-1">
          {mobileMore.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              className={cn(
                "flex h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                isActive(item.href) ? "bg-violet-50 text-violet" : "text-text-primary hover:bg-slate-100"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </Modal>
    </div>
  );
}
