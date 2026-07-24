"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shells/AppShell";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { useAuth } from "@/components/providers/AuthProvider";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !firebaseUser) {
      router.replace("/auth/login");
    }
  }, [loading, firebaseUser, router]);

  if (loading || !firebaseUser) {
    return <FullPageSpinner label="Loading your dashboard..." />;
  }

  return <AppShell>{children}</AppShell>;
}
