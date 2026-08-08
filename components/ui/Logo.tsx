import { cn } from "@/lib/cn";

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  /** A client business's own uploaded logo (Settings → Branding). When
   * set, this replaces the default BizStock mark entirely — used in
   * AppShell once a business's branding has loaded. Public pages
   * (landing, login) never pass this, since there's no business context
   * before login — they always show the platform's own BizStock mark. */
  logoUrl?: string | null;
  /** Overrides the "BizStock" wordmark text — typically a business's own
   * name. Ignored if showWordmark is false. */
  wordmarkText?: string;
}

/** BizStock mark — an isometric stock box with a growth checkmark. Falls
 * back to this default mark whenever a business hasn't set its own logo. */
export function Logo({ size = 32, showWordmark = true, className, logoUrl, wordmarkText }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={wordmarkText ?? "Business logo"}
          width={size}
          height={size}
          style={{ width: size, height: size }}
          className="rounded object-contain"
        />
      ) : (
        <svg
          width={size}
          height={size}
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden={showWordmark}
          role={showWordmark ? undefined : "img"}
          aria-label={showWordmark ? undefined : "BizStock"}
        >
          <polygon points="100,40 170,80 100,120 30,80" fill="#7C3AED" opacity="0.8" />
          <polygon points="30,80 100,120 100,190 30,150" fill="#7C3AED" />
          <polygon points="100,120 170,80 170,150 100,190" fill="#6D28D9" />
          <path
            d="M 60,100 L 95,135 L 155,55"
            stroke="#16A34A"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {showWordmark &&
        (wordmarkText ? (
          <span className="truncate text-lg font-bold tracking-tight text-text-primary">{wordmarkText}</span>
        ) : (
          <span className="text-lg font-bold tracking-tight text-text-primary">
            Biz<span className="text-violet">Stock</span>
          </span>
        ))}
    </span>
  );
}
