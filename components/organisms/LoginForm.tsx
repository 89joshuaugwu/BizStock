"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { loginWithEmail } from "@/lib/auth";

const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/user-not-found": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
};

function friendlyError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code && FIREBASE_ERROR_MESSAGES[code]) return FIREBASE_ERROR_MESSAGES[code];
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

function LoginFormFields() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      toast.success("Welcome back!");
      router.push(searchParams.get("next") || "/dashboard");
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <Input
        label="Email"
        name="email"
        type="email"
        placeholder="you@business.com"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="Password"
        name="password"
        type="password"
        placeholder="Your password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" fullWidth size="lg" loading={loading}>
        Log in
      </Button>
    </form>
  );
}

/** Wrapped in its own Suspense boundary here (rather than in the parent
 * Server Component) since useSearchParams() requires one. */
export function LoginForm() {
  return (
    <Suspense fallback={<div className="mt-8 h-56 animate-pulse rounded-lg bg-slate-100" />}>
      <LoginFormFields />
    </Suspense>
  );
}
