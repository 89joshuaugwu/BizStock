"use client";

import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { updatePassword } from "firebase/auth";
import { OwnerOnlyGuard } from "@/components/shells/OwnerOnlyGuard";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/providers/AuthProvider";
import { updateBusiness } from "@/lib/business";
import { auth } from "@/lib/firebase";

export default function SettingsPage() {
  return (
    <OwnerOnlyGuard>
      <SettingsContent />
    </OwnerOnlyGuard>
  );
}

function SettingsContent() {
  const { business } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [threshold, setThreshold] = useState("");
  const [loadedBusinessId, setLoadedBusinessId] = useState<string | null>(null);
  const [savingBusiness, setSavingBusiness] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Sync the business doc into local form state the first time it loads
  // (or if it changes underneath us) — done during render, per React's
  // "adjusting state when a prop changes" pattern, rather than in a
  // useEffect that would call setState synchronously on every render.
  if (business && business.id !== loadedBusinessId) {
    setLoadedBusinessId(business.id);
    setBusinessName(business.name);
    setThreshold(business.defaultReorderThreshold.toString());
  }

  async function handleBusinessSubmit(e: FormEvent) {
    e.preventDefault();
    const thresholdNum = Number(threshold);
    if (!businessName.trim()) {
      toast.error("Business name is required.");
      return;
    }
    if (!Number.isFinite(thresholdNum) || thresholdNum < 0) {
      toast.error("Enter a valid default reorder threshold.");
      return;
    }

    setSavingBusiness(true);
    try {
      await updateBusiness({ name: businessName.trim(), defaultReorderThreshold: thresholdNum });
      toast.success("Business settings saved.");
    } catch {
      toast.error("Failed to save settings.");
    } finally {
      setSavingBusiness(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match.");
      return;
    }

    setSavingPassword(true);
    try {
      if (!auth.currentUser) throw new Error("Not logged in.");
      await updatePassword(auth.currentUser, newPassword);
      toast.success("Password updated.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/requires-recent-login") {
        toast.error("Please log out and log back in, then try changing your password again.");
      } else {
        toast.error("Failed to update password.");
      }
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">Manage your business info and account.</p>
      </div>

      <div className="max-w-lg space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Business info</CardTitle>
          </CardHeader>
          <form onSubmit={handleBusinessSubmit} className="space-y-4">
            <Input label="Business name" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            <Input
              label="Default reorder threshold"
              type="number"
              min={0}
              required
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              hint="Used as the starting threshold when you add a new product."
            />
            <Button type="submit" loading={savingBusiness}>
              Save changes
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <Input
              label="New password"
              type="password"
              minLength={6}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input
              label="Confirm new password"
              type="password"
              minLength={6}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button type="submit" loading={savingPassword}>
              Update password
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
