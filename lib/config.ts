/**
 * Static fallback platform contact info — used only until an admin sets
 * a real value via /admin (stored in Firestore, see
 * lib/platform-config.ts). Also the seed values shown pre-filled the
 * first time /admin's contact form loads.
 */
export const PLATFORM_CONTACT = {
  whatsappNumber: "2348161780381", // international format, no "+", no spaces
  whatsappMessage: "Hi, I'd like to set up BizStock for my business.",
};

/** Pure URL builder — safe to call from client or server code. Pass the
 * resolved values (from getPlatformConfigServer() or the /api/platform-config
 * fetch) rather than relying on the static defaults, wherever possible. */
export function getWhatsAppLink(
  number: string = PLATFORM_CONTACT.whatsappNumber,
  message: string = PLATFORM_CONTACT.whatsappMessage
): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
