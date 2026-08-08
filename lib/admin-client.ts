"use client";

import type { CreateBusinessAdminInput, CreateBusinessAdminResult, DeleteBusinessResult, UpdateBusinessAdminInput } from "@/lib/admin-businesses";
import type { PlatformConfig } from "@/types/platformConfig";
import type { Business } from "@/types/business";

export interface BusinessListItem extends Business {
  ownerEmail: string;
  ownerName: string;
  ownerActive: boolean;
  staffCount: number;
}

async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? "Request failed.");
  }
  return data;
}

export async function fetchBusinesses(): Promise<BusinessListItem[]> {
  const data = await adminFetch<{ businesses: BusinessListItem[] }>("/api/admin/businesses");
  return data.businesses;
}

export async function createBusiness(input: CreateBusinessAdminInput): Promise<CreateBusinessAdminResult> {
  return adminFetch("/api/admin/businesses", { method: "POST", body: JSON.stringify(input) });
}

export async function updateBusinessRequest(id: string, updates: UpdateBusinessAdminInput): Promise<void> {
  await adminFetch(`/api/admin/businesses/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
}

export async function deleteBusinessRequest(id: string): Promise<DeleteBusinessResult> {
  return adminFetch(`/api/admin/businesses/${id}`, { method: "DELETE" });
}

export async function fetchPlatformConfig(): Promise<PlatformConfig> {
  const data = await adminFetch<{ config: PlatformConfig }>("/api/admin/config");
  return data.config;
}

export async function updatePlatformConfigRequest(updates: Partial<PlatformConfig>): Promise<void> {
  await adminFetch("/api/admin/config", { method: "PATCH", body: JSON.stringify(updates) });
}

export async function adminLogout(): Promise<void> {
  await adminFetch("/api/admin/logout", { method: "POST" });
}
