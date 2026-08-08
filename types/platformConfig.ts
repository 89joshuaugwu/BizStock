/**
 * Platform-wide config, editable from /admin — currently just the
 * WhatsApp contact shown on the public landing/login pages. Single
 * document at /platformConfig/main. Falls back to the static defaults
 * in lib/config.ts if this doc doesn't exist yet (e.g. brand new
 * deployment, admin hasn't opened the panel yet).
 */
export interface PlatformConfig {
  whatsappNumber: string;
  whatsappMessage: string;
}
