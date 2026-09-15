import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { authMode } from "@/lib/auth-mode";

export default function SignInPage() {
  if (authMode() !== "clerk") redirect("/admin");
  return (
    <main className="access-page">
      <SignIn fallbackRedirectUrl="/admin" />
    </main>
  );
}
