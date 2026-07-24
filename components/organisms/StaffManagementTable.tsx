"use client";

import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { UserPlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { auth } from "@/lib/firebase";
import { onAllUsersSnapshot, setUserActive } from "@/lib/users";
import { useAuth } from "@/components/providers/AuthProvider";
import type { AppUser } from "@/types/user";

function generateTempPassword(): string {
  return Math.random().toString(36).slice(-6) + Math.floor(Math.random() * 10);
}

export function StaffManagementTable() {
  const { appUser: currentUser } = useAuth();
  const [staff, setStaff] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);
  const [togglingUid, setTogglingUid] = useState<string | null>(null);
  const [role, setRole] = useState<"staff" | "admin">("staff");

  useEffect(() => {
    const unsub = onAllUsersSnapshot((data) => {
      setStaff(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required.");
      return;
    }

    setInviting(true);
    const tempPassword = generateTempPassword();
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/staff/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), tempPassword, role }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to create staff account.");

      setCreatedCreds({ email: email.trim(), password: tempPassword });
      setName("");
      setEmail("");
      setRole("staff");
      toast.success("Staff account created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create staff account.");
    } finally {
      setInviting(false);
    }
  }

  async function handleToggleActive(user: AppUser) {
    setTogglingUid(user.uid);
    try {
      await setUserActive(user.uid, !user.active);
      toast.success(`${user.displayName} ${user.active ? "deactivated" : "activated"}.`);
    } catch {
      toast.error("Failed to update account status.");
    } finally {
      setTogglingUid(null);
    }
  }

  function closeInviteModal() {
    setInviteOpen(false);
    setCreatedCreds(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-text-secondary">{staff.length} account{staff.length !== 1 ? "s" : ""}</p>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4" /> Add Staff
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 w-full animate-pulse rounded-lg bg-slate-200/60" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((user) => (
            <Card key={user.uid} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium text-text-primary">
                  {user.displayName}
                  {user.uid === currentUser?.uid && <span className="ml-1.5 text-xs text-text-secondary">(you)</span>}
                </p>
                <p className="truncate text-sm text-text-secondary">{user.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium capitalize text-violet-dark">
                  {user.role}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${user.active ? "bg-success-50 text-success" : "bg-slate-100 text-text-secondary"}`}
                >
                  {user.active ? "Active" : "Deactivated"}
                </span>
                {user.role !== "owner" && (currentUser?.role === "owner" || user.role === "staff") && (
                  <Button
                    size="sm"
                    variant={user.active ? "danger" : "success"}
                    loading={togglingUid === user.uid}
                    onClick={() => handleToggleActive(user)}
                  >
                    {user.active ? "Deactivate" : "Activate"}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={inviteOpen} onClose={closeInviteModal} title="Add staff account">
        {createdCreds ? (
          <div>
            <p className="text-sm text-text-secondary">
              Share these credentials with your staff member. They should log in and can be reminded to change
              their password later.
            </p>
            <div className="mt-4 space-y-2 rounded-lg bg-slate-50 p-3 font-mono text-sm">
              <p>Email: {createdCreds.email}</p>
              <p>Temp password: {createdCreds.password}</p>
            </div>
            <Button fullWidth className="mt-5" onClick={closeInviteModal}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="space-y-4">
            <Input label="Staff name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {currentUser?.role === "owner" && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-text-primary">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "staff" | "admin")}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary outline-none focus:border-violet focus:ring-1 focus:ring-violet"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            )}
            <p className="text-xs text-text-secondary">
              A temporary password will be generated automatically — you&apos;ll see it after creating the account.
            </p>
            <Button type="submit" fullWidth loading={inviting}>
              Create staff account
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
