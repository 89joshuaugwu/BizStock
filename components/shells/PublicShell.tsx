import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/">
            <Logo />
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/auth/login"
              className="flex h-10 items-center rounded-lg px-3 text-sm font-medium text-text-secondary hover:text-text-primary"
            >
              Log in
            </Link>
            <Link
              href="/auth/signup"
              className="flex h-10 items-center rounded-lg bg-violet px-4 text-sm font-medium text-white hover:bg-violet-dark"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-white py-6">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-text-secondary sm:px-6">
          © {new Date().getFullYear()} BizStock. Built for small businesses.
        </div>
      </footer>
    </div>
  );
}
