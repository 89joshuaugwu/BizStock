import Link from "next/link";
import { LogIn } from "lucide-react";
import { LoginForm } from "@/components/organisms/LoginForm";
import { getWhatsAppLink } from "@/lib/config";
import { getPlatformConfigServer } from "@/lib/platform-config";

export default async function LoginPage() {
  const config = await getPlatformConfigServer();
  const whatsappLink = getWhatsAppLink(config.whatsappNumber, config.whatsappMessage);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="mb-6 flex items-center gap-2 text-violet">
        <LogIn className="h-5 w-5" />
        <span className="text-sm font-medium">Log in</span>
      </div>
      <h1 className="text-2xl font-bold text-text-primary">Welcome back</h1>
      <p className="mt-1.5 text-sm text-text-secondary">
        Log in with the email and password given to you. Staff: if your account has
        been deactivated, contact your business owner.
      </p>

      <LoginForm />

      <p className="mt-6 text-center text-sm text-text-secondary">
        Don&apos;t have an account yet?{" "}
        <Link href={whatsappLink} target="_blank" rel="noopener noreferrer" className="font-medium text-violet hover:underline">
          Get in touch to set up your business
        </Link>
      </p>
    </div>
  );
}
