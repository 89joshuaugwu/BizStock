import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 text-center">
      <Logo size={36} className="mb-6" />
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-50">
        <PackageSearch className="h-7 w-7 text-violet" />
      </div>
      <h1 className="mt-5 text-2xl font-bold text-text-primary">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-text-secondary">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        href="/"
        className="mt-6 flex h-11 items-center rounded-lg bg-violet px-5 text-sm font-medium text-white hover:bg-violet-dark"
      >
        Back to home
      </Link>
    </div>
  );
}
