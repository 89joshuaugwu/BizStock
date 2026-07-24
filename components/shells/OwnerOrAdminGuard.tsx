"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "@/components/providers/AuthProvider";
import { FullPageSpinner } from "@/components/ui/Spinner";

/**
 * Wraps owner/admin page content (Purchases, Reports, Staff, Settings, and
 * product create/edit). Staff who navigate here directly are bounced back 
 * to the dashboard with a toast.
 */
export function OwnerOrAdminGuard({ children }: { children: ReactNode }) {
  const { appUser, loading, isOwner } = useAuth();
  const router = useRouter();
  const hasWarned = useRef(false);

  const isOwnerOrAdmin = isOwner || appUser?.role === "admin";

  useEffect(() => {
    if (loading || !appUser) return;
    if (!isOwnerOrAdmin && !hasWarned.current) {
      hasWarned.current = true;
      toast.error("This page requires owner or admin privileges.");
      router.replace("/dashboard");
    }
  }, [loading, appUser, isOwnerOrAdmin, router]);

  if (loading || !appUser || !isOwnerOrAdmin) {
    return <FullPageSpinner />;
  }

  return <>{children}</>;
}
