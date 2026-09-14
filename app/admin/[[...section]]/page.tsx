import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { owner } from "@/lib/server";
import { Brand } from "@/app/public-shell";
import Admin from "@/app/admin/admin-client";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section = [] } = await params;
  return <Gate section={section} />;
}
async function Gate({ section }: { section: string[] }) {
  await requireChatGPTUser("/admin/" + section.join("/"));
  const user = await owner();
  if (!user)
    return (
      <main className="access-page">
        <Brand />
        <h1>Owner access required</h1>
        <p>
          This account isn’t on the owner allowlist. The site owner can
          configure OWNER_EMAILS in the deployment settings.
        </p>
        <a href="/">Back to EM² Meals</a>
      </main>
    );
  return <Admin section={section} ownerEmail={user.email} />;
}
