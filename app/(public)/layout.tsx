import type { ReactNode } from "react";
import { PublicShell } from "@/components/shells/PublicShell";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
