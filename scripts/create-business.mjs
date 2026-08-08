#!/usr/bin/env node
/**
 * scripts/create-business.mjs
 *
 * Provisions a new client business on BizStock: creates the Firebase
 * Auth owner account, the /users/{uid} doc, and the /business/{id} doc,
 * all via the Firebase Admin SDK (bypasses Firestore Security Rules —
 * this is the ONLY supported way to create a new business, since public
 * signup is closed — see AUTHENTICATION.md and ADMIN.md).
 *
 * Run from the project root:
 *
 *   node scripts/create-business.mjs
 *
 * Reads the same FIREBASE_ADMIN_* env vars as the running app, from
 * .env.local. Prompts interactively for the rest — nothing is hardcoded,
 * so this is safe to run once per new client without editing the script.
 */

import { config as loadEnv } from "dotenv";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import readline from "node:readline/promises";
import { randomBytes } from "node:crypto";

loadEnv({ path: ".env.local" });

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`\nMissing ${name} in .env.local — copy .env.local.example and fill in your Firebase Admin credentials first.\n`);
    process.exit(1);
  }
  return value;
}

const projectId = requireEnv("FIREBASE_ADMIN_PROJECT_ID");
const clientEmail = requireEnv("FIREBASE_ADMIN_CLIENT_EMAIL");
const privateKey = requireEnv("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n");

const app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const auth = getAuth(app);
const db = getFirestore(app);

function generatePassword() {
  return randomBytes(9).toString("base64").replace(/[+/=]/g, "").slice(0, 10);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidHexColor(color) {
  return /^#([0-9A-Fa-f]{6})$/.test(color);
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (question, { required = true } = {}) => {
    while (true) {
      const answer = (await rl.question(question)).trim();
      if (answer || !required) return answer;
      console.log("This field is required.");
    }
  };

  console.log("\n=== BizStock — New Business Setup ===\n");

  const businessName = await ask("Business name: ");
  const ownerName = await ask("Owner's full name: ");

  let ownerEmail;
  do {
    ownerEmail = await ask("Owner's email: ");
    if (!isValidEmail(ownerEmail)) {
      console.log("That doesn't look like a valid email.");
      ownerEmail = "";
    }
  } while (!ownerEmail);

  const thresholdRaw = await ask("Default reorder threshold [10]: ", { required: false });
  const defaultReorderThreshold = thresholdRaw ? Number(thresholdRaw) : 10;

  let brandColor = null;
  const brandColorRaw = await ask("Brand color as hex, e.g. #7C3AED [skip = use default Violet]: ", { required: false });
  if (brandColorRaw) {
    if (!isValidHexColor(brandColorRaw)) {
      console.log(`"${brandColorRaw}" isn't a valid hex color (expected format #RRGGBB) — leaving brand color unset.`);
    } else {
      brandColor = brandColorRaw;
    }
  }

  const logoUrl = (await ask("Logo image URL [skip = use default BizStock mark]: ", { required: false })) || null;

  rl.close();

  console.log("\nCreating owner account...");

  let ownerUser;
  try {
    ownerUser = await auth.createUser({
      email: ownerEmail,
      password: generatePassword(),
      displayName: ownerName,
    });
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      console.error(`\nAn account already exists for ${ownerEmail}. Use a different email, or check the Firebase Console → Authentication if this was a mistake.\n`);
      process.exit(1);
    }
    throw err;
  }

  // Reset the initial random password immediately with a fresh,
  // clearly-temporary one — createUser() requires SOME password, but we
  // don't want that first throwaway value to be what gets printed below
  // (keeps the printed credential the actual, single source of truth).
  const tempPassword = generatePassword();
  await auth.updateUser(ownerUser.uid, { password: tempPassword });

  const businessRef = db.collection("business").doc();
  await businessRef.set({
    name: businessName,
    ownerUid: ownerUser.uid,
    defaultReorderThreshold: Number.isFinite(defaultReorderThreshold) ? defaultReorderThreshold : 10,
    logoUrl,
    brandColor,
    createdAt: Timestamp.now(),
  });

  await db.collection("users").doc(ownerUser.uid).set({
    uid: ownerUser.uid,
    email: ownerEmail,
    displayName: ownerName,
    role: "owner",
    active: true,
    businessId: businessRef.id,
    createdAt: Timestamp.now(),
  });

  console.log("\n✅ Business created.\n");
  console.log("──────────────────────────────────────────");
  console.log(`Business:     ${businessName}`);
  console.log(`Business ID:  ${businessRef.id}`);
  console.log(`Owner email:  ${ownerEmail}`);
  console.log(`Temp password: ${tempPassword}`);
  console.log("──────────────────────────────────────────");
  console.log("\nSend the email + temp password to the business owner so they can log in at /auth/login.");
  console.log("They should change their password from Settings after logging in.\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("\nFailed to create business:", err);
  process.exit(1);
});
