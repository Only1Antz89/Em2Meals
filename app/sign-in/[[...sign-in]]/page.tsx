import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in | Em2 Catering Platform",
  robots: { index: false, follow: false },
};
import { authMode } from "@/lib/auth-mode";

export default function SignInPage() {
  if (authMode() !== "clerk") redirect("/admin");
  return (
    <main className="access-page">
      <SignIn fallbackRedirectUrl="/admin" />
    </main>
  );
}
