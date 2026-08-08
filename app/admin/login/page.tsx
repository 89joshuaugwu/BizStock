"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Login failed.");

      router.push("/admin");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <Logo size={36} className="mb-6" />
      <div className="w-full max-w-sm rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2 text-violet">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-sm font-medium">Platform admin</span>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Admin password"
            type="password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" fullWidth loading={loading}>
            Log in
          </Button>
        </form>
      </div>
      <p className="mt-4 text-center text-xs text-text-secondary">
        This is a separate, platform-level login — not connected to any business account.
      </p>
    </div>
  );
}
