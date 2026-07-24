"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Store } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { signUpOwner } from "@/lib/auth";
import { checkBusinessExists } from "@/app/actions";

const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "An account already exists with this email.",
  "auth/weak-password": "Password should be at least 6 characters.",
  "auth/invalid-email": "Enter a valid email address.",
};

function friendlyError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code && FIREBASE_ERROR_MESSAGES[code]) return FIREBASE_ERROR_MESSAGES[code];
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    businessName: "",
    ownerName: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    checkBusinessExists().then((exists) => {
      if (exists) {
        toast.error("A business is already registered on this system.");
        router.push("/auth/login");
      }
    });
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signUpOwner(form);
      toast.success("Business created. Welcome to BizStock!");
      router.push("/dashboard");
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="mb-6 flex items-center gap-2 text-violet">
        <Store className="h-5 w-5" />
        <span className="text-sm font-medium">Owner signup</span>
      </div>
      <h1 className="text-2xl font-bold text-text-primary">Set up your business</h1>
      <p className="mt-1.5 text-sm text-text-secondary">
        This creates your business record and gives you the owner account — full
        control over products, staff, purchases, and reports.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Input
          label="Business name"
          name="businessName"
          placeholder="e.g. Chidi's Superstore"
          required
          value={form.businessName}
          onChange={(e) => setForm({ ...form, businessName: e.target.value })}
        />
        <Input
          label="Your name"
          name="ownerName"
          placeholder="e.g. Chidi Okafor"
          required
          value={form.ownerName}
          onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
        />
        <Input
          label="Email"
          name="email"
          type="email"
          placeholder="you@business.com"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Input
          label="Password"
          name="password"
          type="password"
          placeholder="At least 6 characters"
          minLength={6}
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <Button type="submit" fullWidth size="lg" loading={loading}>
          Create my business
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Already have an account?{" "}
        <Link href="/auth/login" className="font-medium text-violet hover:underline">
          Log in
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-text-secondary">
        Staff accounts are created by the business owner from the dashboard — there&apos;s
        no public staff signup.
      </p>
    </div>
  );
}
