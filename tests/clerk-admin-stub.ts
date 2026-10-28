// Stand-in for lib/clerk-admin.ts so team tests never call Clerk.
export const clerkCalls: string[] = [];
export async function inviteToClerk(email: string) {
  clerkCalls.push(`invite:${email}`);
  return "invited" as const;
}
export async function clerkSignInLink(email: string, origin: string) {
  clerkCalls.push(`reset:${email}`);
  if (email.startsWith("nobody")) return null;
  return `${origin}/sign-in?__clerk_ticket=test-ticket`;
}
export async function revokeClerkSessions(email: string) {
  clerkCalls.push(`revoke:${email}`);
}
