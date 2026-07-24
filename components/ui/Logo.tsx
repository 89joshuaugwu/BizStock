import { cn } from "@/lib/cn";

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

/** BizStock mark — an isometric stock box with a growth checkmark, per the
 * brand asset provided for this build. Rendered inline (not <img>) so it
 * always matches text color/size cleanly at any scale. */
export function Logo({ size = 32, showWordmark = true, className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
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
      {showWordmark && (
        <span className="text-lg font-bold tracking-tight text-text-primary">
          Biz<span className="text-violet">Stock</span>
        </span>
      )}
    </span>
  );
}
