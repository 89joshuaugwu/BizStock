"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Building2,
  ImagePlus,
  Loader2,
  LogOut,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Card } from "@/components/ui/Card";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { uploadImage } from "@/lib/cloudinary";
import {
  adminLogout,
  createBusiness,
  deleteBusinessRequest,
  fetchBusinesses,
  fetchPlatformConfig,
  updateBusinessRequest,
  updatePlatformConfigRequest,
  type BusinessListItem,
} from "@/lib/admin-client";
import type { PlatformConfig } from "@/types/platformConfig";

const DEFAULT_BRAND_COLOR = "#7C3AED";

function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{6})$/.test(color);
}

export function AdminDashboard() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<BusinessListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessListItem | null>(null);
  const [deleting, setDeleting] = useState<BusinessListItem | null>(null);

  async function reload() {
    try {
      const data = await fetchBusinesses();
      setBusinesses(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load businesses.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Inline, self-invoking async load on mount — deliberately not just
    // `reload()` called directly, so setState calls happen inside a
    // nested Promise-resolution callback rather than a same-tick call
    // from the effect body (see react.dev/learn/you-might-not-need-an-effect).
    // `reload` itself is still used directly (and correctly) from event
    // handlers elsewhere (the create/edit/delete modals' onSuccess
    // callbacks), where calling setState is always fine.
    (async () => {
      const data = await fetchBusinesses().catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Failed to load businesses.");
        return null;
      });
      if (data) setBusinesses(data);
      setLoading(false);
    })();
  }, []);

  async function handleLogout() {
    await adminLogout();
    router.push("/admin/login");
  }

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-border bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Logo size={28} />
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-sm text-text-secondary sm:flex">
              <ShieldCheck className="h-4 w-4" /> Platform admin
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" /> Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <ContactNumberCard />

        <div className="mb-4 mt-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Businesses</h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              {businesses.length} business{businesses.length !== 1 ? "es" : ""}
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create business
          </Button>
        </div>

        {loading ? (
          <FullPageSpinner />
        ) : businesses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <Building2 className="mx-auto h-8 w-8 text-text-secondary" />
            <p className="mt-3 font-medium text-text-primary">No businesses yet</p>
            <p className="mt-1 text-sm text-text-secondary">Create the first one to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {businesses.map((b) => (
              <BusinessCard key={b.id} business={b} onEdit={() => setEditing(b)} onDelete={() => setDeleting(b)} />
            ))}
          </div>
        )}
      </main>

      <CreateBusinessModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          reload();
        }}
      />

      {editing && (
        <EditBusinessModal
          business={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}

      {deleting && (
        <DeleteBusinessModal
          business={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function BusinessCard({
  business,
  onEdit,
  onDelete,
}: {
  business: BusinessListItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border"
          style={{ backgroundColor: business.brandColor ?? "#F5F3FF" }}
        >
          {business.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logoUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <Building2 className="h-5 w-5" style={{ color: business.brandColor ? "#fff" : "#7C3AED" }} />
          )}
        </div>
        <div>
          <p className="font-semibold text-text-primary">{business.name}</p>
          <p className="text-sm text-text-secondary">
            {business.ownerName} · {business.ownerEmail}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-1 text-sm text-text-secondary sm:flex">
          <Users className="h-3.5 w-3.5" /> {business.staffCount} staff
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${business.ownerActive ? "bg-success-50 text-success" : "bg-slate-100 text-text-secondary"}`}
        >
          {business.ownerActive ? "Active" : "Deactivated"}
        </span>
        <Button size="sm" variant="secondary" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
        <Button size="sm" variant="danger" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </div>
    </Card>
  );
}

function ContactNumberCard() {
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPlatformConfig()
      .then((c) => {
        setConfig(c);
        setNumber(c.whatsappNumber);
        setMessage(c.whatsappMessage);
      })
      .catch(() => toast.error("Failed to load contact settings."));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{7,15}$/.test(number)) {
      toast.error("Number should be digits only, international format, e.g. 2348161780381.");
      return;
    }

    setSaving(true);
    try {
      await updatePlatformConfigRequest({ whatsappNumber: number, whatsappMessage: message });
      toast.success("Contact number updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Phone className="h-4 w-4 text-violet" />
        <h2 className="font-bold text-text-primary">Contact number</h2>
      </div>
      <p className="mb-4 text-sm text-text-secondary">
        Shown as the &ldquo;Get started&rdquo; / &ldquo;Get in touch&rdquo; WhatsApp link on the public landing and
        login pages.
      </p>
      {!config ? (
        <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <Input
            label="WhatsApp number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="2348161780381"
            hint="Digits only, international format, no + or spaces."
          />
          <Input label="Pre-filled message" value={message} onChange={(e) => setMessage(e.target.value)} />
          <div className="sm:col-span-2">
            <Button type="submit" loading={saving}>
              Save
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

interface BrandingFieldsState {
  logoUrl: string | null;
  brandColor: string;
  uploadingLogo: boolean;
}

function LogoUploadField({
  value,
  onChange,
}: {
  value: BrandingFieldsState;
  onChange: (next: Partial<BrandingFieldsState>) => void;
}) {
  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange({ uploadingLogo: true });
    try {
      const url = await uploadImage(file);
      onChange({ logoUrl: url, uploadingLogo: false });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logo upload failed.");
      onChange({ uploadingLogo: false });
    } finally {
      e.target.value = "";
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-text-primary">Logo</label>
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-slate-50">
          {value.uploadingLogo ? (
            <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
          ) : value.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.logoUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <ImagePlus className="h-5 w-5 text-text-secondary" />
          )}
        </div>
        <label className="flex h-10 cursor-pointer items-center rounded-lg border border-border bg-white px-3 text-sm font-medium text-text-primary hover:bg-slate-50">
          {value.logoUrl ? "Replace" : "Upload"}
          <input type="file" accept="image/*" className="hidden" onChange={handleChange} disabled={value.uploadingLogo} />
        </label>
        {value.logoUrl && (
          <button
            type="button"
            onClick={() => onChange({ logoUrl: null })}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary hover:bg-error-50 hover:text-error"
            aria-label="Remove logo"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function BrandColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor="brandColor" className="mb-1.5 block text-sm font-medium text-text-primary">
        Brand color
      </label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={isValidHexColor(value) ? value : DEFAULT_BRAND_COLOR}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-border bg-white p-1"
          aria-label="Pick brand color"
        />
        <Input id="brandColor" value={value} onChange={(e) => onChange(e.target.value)} placeholder="#7C3AED" className="font-mono" />
      </div>
    </div>
  );
}

function CreateBusinessModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [threshold, setThreshold] = useState("10");
  const [branding, setBranding] = useState<BrandingFieldsState>({ logoUrl: null, brandColor: "", uploadingLogo: false });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);

  function reset() {
    setBusinessName("");
    setOwnerName("");
    setOwnerEmail("");
    setThreshold("10");
    setBranding({ logoUrl: null, brandColor: "", uploadingLogo: false });
    setResult(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (branding.brandColor && !isValidHexColor(branding.brandColor)) {
      toast.error("Brand color must be a hex code like #7C3AED.");
      return;
    }

    setSaving(true);
    try {
      const res = await createBusiness({
        businessName,
        ownerName,
        ownerEmail,
        defaultReorderThreshold: Number(threshold) || 10,
        logoUrl: branding.logoUrl,
        brandColor: branding.brandColor || null,
      });
      setResult({ email: ownerEmail, password: res.tempPassword });
      toast.success("Business created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create business.");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    onClose();
    if (result) onCreated();
    reset();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create business">
      {result ? (
        <div>
          <p className="text-sm text-text-secondary">Send these credentials to the business owner.</p>
          <div className="mt-4 space-y-2 rounded-lg bg-slate-50 p-3 font-mono text-sm">
            <p>Email: {result.email}</p>
            <p>Temp password: {result.password}</p>
          </div>
          <Button fullWidth className="mt-5" onClick={handleClose}>
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Business name" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          <Input label="Owner's full name" required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          <Input label="Owner's email" type="email" required value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
          <Input
            label="Default reorder threshold"
            type="number"
            min={0}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
          <LogoUploadField value={branding} onChange={(patch) => setBranding((b) => ({ ...b, ...patch }))} />
          <BrandColorField value={branding.brandColor} onChange={(v) => setBranding((b) => ({ ...b, brandColor: v }))} />
          <Button type="submit" fullWidth loading={saving}>
            Create business
          </Button>
        </form>
      )}
    </Modal>
  );
}

function EditBusinessModal({
  business,
  onClose,
  onSaved,
}: {
  business: BusinessListItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(business.name);
  const [threshold, setThreshold] = useState(business.defaultReorderThreshold.toString());
  const [ownerActive, setOwnerActive] = useState(business.ownerActive);
  const [branding, setBranding] = useState<BrandingFieldsState>({
    logoUrl: business.logoUrl,
    brandColor: business.brandColor ?? "",
    uploadingLogo: false,
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (branding.brandColor && !isValidHexColor(branding.brandColor)) {
      toast.error("Brand color must be a hex code like #7C3AED.");
      return;
    }
    const thresholdNum = Number(threshold);
    if (!Number.isFinite(thresholdNum) || thresholdNum < 0) {
      toast.error("Invalid reorder threshold.");
      return;
    }

    setSaving(true);
    try {
      await updateBusinessRequest(business.id, {
        name,
        defaultReorderThreshold: thresholdNum,
        logoUrl: branding.logoUrl,
        brandColor: branding.brandColor || null,
        ownerActive,
      });
      toast.success("Business updated.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit ${business.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Business name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="Default reorder threshold"
          type="number"
          min={0}
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
        />
        <LogoUploadField value={branding} onChange={(patch) => setBranding((b) => ({ ...b, ...patch }))} />
        <BrandColorField value={branding.brandColor} onChange={(v) => setBranding((b) => ({ ...b, brandColor: v }))} />

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium text-text-primary">Owner account active</p>
            <p className="text-xs text-text-secondary">Deactivating blocks the owner (and effectively the business) from logging in.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={ownerActive}
            onClick={() => setOwnerActive((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${ownerActive ? "bg-success" : "bg-slate-300"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${ownerActive ? "translate-x-5" : "translate-x-0.5"}`}
            />
          </button>
        </div>

        <Button type="submit" fullWidth loading={saving}>
          Save changes
        </Button>
      </form>
    </Modal>
  );
}

function DeleteBusinessModal({
  business,
  onClose,
  onDeleted,
}: {
  business: BusinessListItem;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const canDelete = confirmText.trim() === business.name;

  async function handleDelete() {
    if (!canDelete) return;
    setDeleting(true);
    try {
      const result = await deleteBusinessRequest(business.id);
      toast.success(
        `${business.name} deleted — ${result.deletedCounts.products} products, ${result.deletedCounts.sales} sales, ${result.deletedCounts.purchases} purchases removed.`
      );
      if (result.authAccountFailures.length > 0) {
        toast.error(`${result.authAccountFailures.length} account(s) couldn't be removed from Firebase Auth — check the console log.`);
      }
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete business.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Delete ${business.name}?`}>
      <div className="rounded-lg border border-error/20 bg-error-50 p-3 text-sm text-error">
        This permanently deletes this business&apos;s products, sales, purchases, stock history, and every staff/owner
        account tied to it — including their Firebase Auth logins. This cannot be undone.
      </div>
      <p className="mt-4 text-sm text-text-secondary">
        Type <span className="font-semibold text-text-primary">{business.name}</span> to confirm.
      </p>
      <Input
        className="mt-2"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={business.name}
      />
      <div className="mt-5 flex gap-2">
        <Button variant="secondary" fullWidth onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button variant="danger" fullWidth disabled={!canDelete} loading={deleting} onClick={handleDelete}>
          Delete permanently
        </Button>
      </div>
    </Modal>
  );
}
