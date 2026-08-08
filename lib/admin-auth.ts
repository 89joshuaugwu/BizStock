import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Platform-admin authentication — DELIBERATELY separate from the
 * owner/staff Firebase Auth + Firestore-rules model used everywhere
 * else in this app. There is exactly one admin: you, the person running
 * this deployment. Rather than inventing a "platform admin" user role
 * inside the multi-tenant rules (which would mean teaching every rule
 * and every route about an identity that can see EVERY business's data —
 * real new attack surface reachable from a browser), admin access here
 * is a single shared secret (ADMIN_PASSWORD) that only you know, checked
 * server-side, with a signed session cookie. It never touches Firestore
 * Security Rules and never creates a Firebase Auth account — see
 * ADMIN.md for the full reasoning.
 *
 * All admin data operations (lib/admin-businesses.ts) still use the
 * Firebase Admin SDK, same as everything else server-side in this app —
 * this file is ONLY about proving "the request came from someone who
 * knows the admin password," nothing more.
 */

const COOKIE_NAME = "bizstock_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing ADMIN_SESSION_SECRET in .env.local — see .env.local.example.");
  }
  return secret;
}

function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("Missing ADMIN_PASSWORD in .env.local — see .env.local.example.");
  }
  return password;
}

/** Timing-safe comparison — avoids leaking how many leading characters
 * of a guessed password were correct via response-time differences. */
export function verifyAdminPassword(candidate: string): boolean {
  const expected = getAdminPassword();
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

/** Creates a signed, self-contained session token: `${expiresAt}.${signature}`.
 * No server-side session store needed — verification just re-computes the
 * HMAC and checks expiry, both cheap and stateless. */
export function createAdminSessionToken(): string {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  let expectedSignature: string;
  try {
    expectedSignature = sign(payload);
  } catch {
    // ADMIN_SESSION_SECRET isn't configured — fail safe (treat as
    // "not authenticated," which sends the admin to /admin/login rather
    // than crashing the page) instead of throwing here.
    return false;
  }

  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  return true;
}

export const ADMIN_SESSION_COOKIE_NAME = COOKIE_NAME;
export const ADMIN_SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_SECONDS;

export class AdminAuthError extends Error {}

/** Used at the top of every /api/admin/* route (except login). Throws if
 * the request doesn't carry a valid, unexpired admin session cookie. */
export function requireAdminSession(request: { cookies: { get(name: string): { value: string } | undefined } }): void {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!verifyAdminSessionToken(token)) {
    throw new AdminAuthError("Not authenticated as admin.");
  }
}
