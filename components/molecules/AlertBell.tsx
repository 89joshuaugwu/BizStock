"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, PackageX, TriangleAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/components/providers/AuthProvider";
import { onNotificationsSnapshot, markNotificationRead } from "@/lib/notifications";
import type { AppNotification } from "@/types/notification";
import { cn } from "@/lib/cn";

export function AlertBell() {
  const { firebaseUser } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = onNotificationsSnapshot(firebaseUser.uid, setNotifications);
    return () => unsub();
  }, [firebaseUser]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        className="relative flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary hover:bg-slate-100"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-30 w-80 max-w-[90vw] rounded-xl border border-border bg-white shadow-lg">
          <div className="border-b border-border px-4 py-3">
            <p className="font-semibold text-text-primary">Notifications</p>
          </div>
          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-text-secondary">You&apos;re all caught up.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => firebaseUser && markNotificationRead(firebaseUser.uid, n.id)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left last:border-0 hover:bg-slate-50",
                    !n.read && "bg-violet-50/50"
                  )}
                >
                  {n.type === "out_of_stock" ? (
                    <PackageX className="mt-0.5 h-4 w-4 shrink-0 text-error" />
                  ) : (
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary">{n.message}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {n.createdAt?.toDate ? formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true }) : ""}
                    </p>
                  </div>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet" />}
                </button>
              ))
            )}
          </div>
          <div className="border-t border-border px-4 py-2.5">
            <Link
              href="/dashboard/products"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-violet hover:underline"
            >
              View products →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
