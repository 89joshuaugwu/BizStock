"use client";

/**
 * Unsigned Cloudinary upload via direct fetch() (not the SDK) — this
 * matches the working pattern from the other Cloudinary-backed apps in
 * this stack: SDK uploads have been flaky here, plain fetch() to the
 * upload endpoint is reliable. Requires an UNSIGNED upload preset
 * (Cloudinary dashboard → Settings → Upload → Add upload preset →
 * Signing Mode: Unsigned) so no server-side signing step is needed.
 *
 * Generic — used for both product photos (ProductForm) and business
 * logos (Settings page branding section).
 */
export async function uploadImage(file: File): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary is not configured. Check NEXT_PUBLIC_CLOUDINARY_* env vars.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Image upload failed. Please try again.");
  }

  const data = await res.json();
  return data.secure_url as string;
}
