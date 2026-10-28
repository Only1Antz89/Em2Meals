import { clerkClient } from "@clerk/nextjs/server";

// Clerk account actions for team management. Only used when AUTH_MODE=clerk
// and CLERK_SECRET_KEY is set.

// Emails an invitation to create an account. Returns "exists" when the
// person already has an account and can simply sign in.
export async function inviteToClerk(email: string, redirectUrl: string) {
  const client = await clerkClient();
  const existing = await client.users.getUserList({ emailAddress: [email] });
  if (existing.data.length) return "exists" as const;
  await client.invitations.createInvitation({
    emailAddress: email,
    redirectUrl,
    notify: true,
    ignoreExisting: true,
  });
  return "invited" as const;
}

// A one-time sign-in link, valid for 24 hours, for someone who is locked out.
// Once signed in they set a new password from My account. Returns null when
// the person hasn't created their account yet.
export async function clerkSignInLink(email: string, origin: string) {
  const client = await clerkClient();
  const users = await client.users.getUserList({ emailAddress: [email] });
  const user = users.data[0];
  if (!user) return null;
  const token = await client.signInTokens.createSignInToken({
    userId: user.id,
    expiresInSeconds: 24 * 60 * 60,
  });
  const url = new URL("/sign-in", origin);
  url.searchParams.set("__clerk_ticket", token.token);
  url.searchParams.set("redirect_url", "/admin/settings/account");
  return url.toString();
}

// Signs the person out everywhere, used when their access is suspended or
// removed. Access is also refused on every request, so this is belt and braces.
export async function revokeClerkSessions(email: string) {
  const client = await clerkClient();
  const users = await client.users.getUserList({ emailAddress: [email] });
  for (const user of users.data) {
    const sessions = await client.sessions.getSessionList({
      userId: user.id,
      status: "active",
    });
    for (const session of sessions.data)
      await client.sessions.revokeSession(session.id);
  }
}
