/**
 * Platform-level config for whoever operates this BizStock deployment
 * (i.e. the person running scripts/create-business.mjs for clients).
 * Edit these two values for your own deployment — everything else in the
 * app reads from here rather than hardcoding contact info in multiple
 * places.
 */
export const PLATFORM_CONTACT = {
  whatsappNumber: "2348161780381", // international format, no "+", no spaces
  whatsappMessage: "Hi, I'd like to set up BizStock for my business.",
};

export function getWhatsAppLink(message = PLATFORM_CONTACT.whatsappMessage): string {
  return `https://wa.me/${PLATFORM_CONTACT.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
