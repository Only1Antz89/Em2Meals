import { SignUp } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { authMode } from "@/lib/auth-mode";

export default function SignUpPage() {
  if (authMode() !== "clerk") redirect("/admin");
  return (
    <main className="access-page">
      <SignUp fallbackRedirectUrl="/admin" />
    </main>
  );
}
