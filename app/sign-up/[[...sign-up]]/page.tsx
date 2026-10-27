import { SignUp } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create account | Em2 Catering Platform",
  robots: { index: false, follow: false },
};
import { authMode } from "@/lib/auth-mode";

export default function SignUpPage() {
  if (authMode() !== "clerk") redirect("/admin");
  return (
    <main className="access-page">
      <SignUp fallbackRedirectUrl="/admin" />
    </main>
  );
}
