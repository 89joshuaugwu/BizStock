"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "@/components/providers/AuthProvider";
import { FullPageSpinner } from "@/components/ui/Spinner";

/**
 * Wraps owner-only page content (Purchases, Reports, Staff, Settings, and
 * product create/edit) — per CONTEXT.md Section 4 RBAC table. Staff who
 * navigate here directly (e.g. via a saved URL) are bounced back to the
 * dashboard with a toast rather than shown a broken/empty page.
 */
export function OwnerOnlyGuard({ children }: { children: ReactNode }) {
  const { appUser, loading, isOwner } = useAuth();
  const router = useRouter();
  const hasWarned = useRef(false);

  useEffect(() => {
    if (loading || !appUser) return;
    if (!isOwner && !hasWarned.current) {
      hasWarned.current = true;
      toast.error("This page is only available to the business owner.");
      router.replace("/dashboard");
    }
  }, [loading, appUser, isOwner, router]);

  if (loading || !appUser || !isOwner) {
    return <FullPageSpinner />;
  }

  return <>{children}</>;
}
