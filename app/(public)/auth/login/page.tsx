"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { LogIn } from "lucide-react";
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

function LoginForm() {
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

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="mb-6 flex items-center gap-2 text-violet">
        <LogIn className="h-5 w-5" />
        <span className="text-sm font-medium">Owner & staff login</span>
      </div>
      <h1 className="text-2xl font-bold text-text-primary">Welcome back</h1>
      <p className="mt-1.5 text-sm text-text-secondary">
        Log in with the email and password given to you. Staff: if your account has
        been deactivated, contact your business owner.
      </p>

      <Suspense fallback={<div className="mt-8 h-56 animate-pulse rounded-lg bg-slate-100" />}>
        <LoginForm />
      </Suspense>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Setting up a new business?{" "}
        <Link href="/auth/signup" className="font-medium text-violet hover:underline">
          Sign up as owner
        </Link>
      </p>
    </div>
  );
}
