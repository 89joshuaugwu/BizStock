/** Minimal className joiner — no extra dependency needed for this project's
 * scale of conditional classes. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
