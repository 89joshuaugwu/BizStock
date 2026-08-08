"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import toast from "react-hot-toast";
import { updatePassword } from "firebase/auth";
import { ImagePlus, Loader2, X } from "lucide-react";
import { OwnerOnlyGuard } from "@/components/shells/OwnerOnlyGuard";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/providers/AuthProvider";
import { updateBusiness } from "@/lib/business";
import { uploadImage } from "@/lib/cloudinary";
import { auth } from "@/lib/firebase";

export default function SettingsPage() {
  return (
    <OwnerOnlyGuard>
      <SettingsContent />
    </OwnerOnlyGuard>
  );
}

const DEFAULT_BRAND_COLOR = "#7C3AED";

function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{6})$/.test(color);
}

function SettingsContent() {
  const { business, businessId } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [threshold, setThreshold] = useState("");
  const [loadedBusinessId, setLoadedBusinessId] = useState<string | null>(null);
  const [savingBusiness, setSavingBusiness] = useState(false);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState(DEFAULT_BRAND_COLOR);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);

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
    setLogoUrl(business.logoUrl);
    setBrandColor(business.brandColor ?? DEFAULT_BRAND_COLOR);
  }

  async function handleBusinessSubmit(e: FormEvent) {
    e.preventDefault();
    if (!businessId) return;

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
      await updateBusiness(businessId, { name: businessName.trim(), defaultReorderThreshold: thresholdNum });
      toast.success("Business settings saved.");
    } catch {
      toast.error("Failed to save settings.");
    } finally {
      setSavingBusiness(false);
    }
  }

  async function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const url = await uploadImage(file);
      setLogoUrl(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logo upload failed.");
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  }

  async function handleBrandingSubmit(e: FormEvent) {
    e.preventDefault();
    if (!businessId) return;

    if (brandColor && !isValidHexColor(brandColor)) {
      toast.error("Brand color must be a hex code like #7C3AED.");
      return;
    }

    setSavingBranding(true);
    try {
      await updateBusiness(businessId, { logoUrl, brandColor: brandColor || null });
      toast.success("Branding updated.");
    } catch {
      toast.error("Failed to save branding.");
    } finally {
      setSavingBranding(false);
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
        <p className="mt-1 text-sm text-text-secondary">Manage your business info, branding, and account.</p>
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
            <CardTitle>Branding</CardTitle>
          </CardHeader>
          <form onSubmit={handleBrandingSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">Logo</label>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-slate-50">
                  {uploadingLogo ? (
                    <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
                  ) : logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Business logo" className="h-full w-full object-contain" />
                  ) : (
                    <ImagePlus className="h-5 w-5 text-text-secondary" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex h-10 cursor-pointer items-center rounded-lg border border-border bg-white px-3 text-sm font-medium text-text-primary hover:bg-slate-50">
                    {logoUrl ? "Replace logo" : "Upload logo"}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} disabled={uploadingLogo} />
                  </label>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl(null)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary hover:bg-error-50 hover:text-error"
                      aria-label="Remove logo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1.5 text-xs text-text-secondary">Shown in your dashboard header in place of the default BizStock mark.</p>
            </div>

            <div>
              <label htmlFor="brandColor" className="mb-1.5 block text-sm font-medium text-text-primary">
                Brand color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={isValidHexColor(brandColor) ? brandColor : DEFAULT_BRAND_COLOR}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-border bg-white p-1"
                  aria-label="Pick brand color"
                />
                <Input
                  id="brandColor"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  placeholder="#7C3AED"
                  className="font-mono"
                />
              </div>
              <p className="mt-1.5 text-xs text-text-secondary">
                Replaces Violet as your dashboard&apos;s primary color — buttons, links, and highlights.
              </p>
            </div>

            <Button type="submit" loading={savingBranding}>
              Save branding
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
