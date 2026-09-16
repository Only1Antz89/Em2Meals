import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { owner } from "@/lib/server";
import { Brand } from "@/app/public-shell";
import Admin from "@/app/admin/admin-client";
import { authMode } from "@/lib/auth-mode";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const [{ section = [] }, query] = await Promise.all([params, searchParams]);
  if (section[0] === "expiry") {
    const requestedMode = Array.isArray(query.mode) ? query.mode[0] : query.mode;
    const mode = requestedMode === "sample" ? "sample" : "live";
    redirect(`/admin/inventory/storage-expiry?mode=${mode}`);
  }
  return <Gate section={section} />;
}
async function Gate({ section }: { section: string[] }) {
  await requireChatGPTUser("/admin/" + section.join("/"));
  const user = await owner();
  if (!user)
    return (
      <main className="access-page">
        <Brand admin />
        <h1>Owner access required</h1>
        <p>
          This account isn’t on the owner allowlist. The site owner can
          configure OWNER_EMAILS in the deployment settings.
        </p>
        <a href="/">Back to Fork Goodness Baked</a>
      </main>
    );
  return (
    <>
      {authMode() === "demo" && (
        <div className="demo-access-banner" role="status">
          Demo mode: owner authentication is temporarily disabled.
        </div>
      )}
      <Admin
        section={section}
        ownerEmail={user.email}
        authMode={authMode()}
      />
    </>
  );
}
