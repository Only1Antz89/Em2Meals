import { z } from "zod";
import { getDb } from "@/db";
import {
  config,
  errorResponse,
  jsonBody,
  requireAccess,
  sameOrigin,
} from "@/lib/server";
import { authMode } from "@/lib/auth-mode";
import { normaliseEmail, roleInfo, roles } from "@/lib/access";
import {
  deploymentOwners,
  ensureTeamTables,
  findTeamMember,
  listAccessEvents,
  listTeamMembers,
  recordAccessEvent,
} from "@/lib/team";
import { emailProvider, sendEmail } from "@/lib/email";

const noStore = { headers: { "Cache-Control": "no-store" } };

function clerkReady() {
  return authMode() === "clerk" && !!config().CLERK_SECRET_KEY;
}

// Team access for the Settings page. Owners only.
export async function GET() {
  try {
    const me = await requireAccess("team");
    const c = config();
    return Response.json(
      {
        me: { email: normaliseEmail(me.email), source: me.source },
        authMode: authMode(),
        accountService: clerkReady(),
        emailReady: !!(emailProvider(c) && c.EMAIL_FROM),
        deploymentOwners: deploymentOwners(c).emails,
        members: await listTeamMembers(),
        events: await listAccessEvents(),
      },
      noStore,
    );
  } catch (e) {
    return errorResponse(e, 503);
  }
}

const email = z
  .string()
  .trim()
  .email("Enter a valid email address")
  .max(254)
  .transform(normaliseEmail);
const body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("invite"),
    email,
    name: z.string().trim().max(120).default(""),
    role: z.enum(roles),
  }),
  z.object({ action: z.literal("role"), email, role: z.enum(roles) }),
  z.object({ action: z.literal("suspend"), email }),
  z.object({ action: z.literal("reactivate"), email }),
  z.object({ action: z.literal("remove"), email }),
  z.object({ action: z.literal("reset"), email }),
]);

export async function POST(req: Request) {
  try {
    const me = await requireAccess("team");
    sameOrigin(req);
    const p = body.parse(await jsonBody(req));
    const c = config();
    const actor = normaliseEmail(me.email);
    const now = new Date().toISOString();
    const owners = deploymentOwners(c).emails;
    const db = getDb();
    await ensureTeamTables();

    if (p.email === actor && p.action !== "invite" && p.action !== "reset")
      throw Error(
        "You can't change your own access. Ask another owner, so nobody locks themselves out.",
      );
    if (owners.includes(p.email) && p.action !== "reset")
      throw Error(
        "This person is an owner through the deployment settings (OWNER_EMAILS). Change it there.",
      );
    const existing = await findTeamMember(p.email);
    let message = "";
    let link: string | undefined;

    switch (p.action) {
      case "invite": {
        if (owners.includes(p.email) || p.email === actor)
          throw Error("This person already has owner access");
        if (existing)
          throw Error(
            existing.status === "active"
              ? "This person is already on the team. Change their role instead."
              : "This person is suspended. Reactivate them instead.",
          );
        await db
          .prepare(
            "INSERT INTO team_members(email,name,role,status,invited_by,created_at,updated_at) VALUES(?,?,?,'active',?,?,?)",
          )
          .bind(p.email, p.name, p.role, actor, now, now)
          .run();
        message = `${p.email} added as ${roleInfo[p.role].label}.`;
        if (clerkReady()) {
          const { inviteToClerk } = await import("@/lib/clerk-admin");
          try {
            const result = await inviteToClerk(
              p.email,
              new URL("/sign-up", req.url).toString(),
            );
            message +=
              result === "exists"
                ? " They already have an account, so they can sign in now."
                : " An invitation email to create their account is on its way.";
          } catch (error) {
            console.error("Clerk invitation failed", error);
            message +=
              " The invitation email couldn't be sent, so ask them to create an account at the sign-up page.";
          }
        } else if (authMode() === "demo") {
          message +=
            " Sign-in is switched off in demo mode, so this takes effect once proper sign-in is turned on.";
        } else {
          message += " They can sign in now with this email address.";
        }
        await recordAccessEvent({
          actor,
          action: "invite",
          target: p.email,
          detail: roleInfo[p.role].label,
        });
        break;
      }
      case "role": {
        if (!existing) throw Error("Team member not found");
        if (existing.role === p.role) {
          message = "No change.";
          break;
        }
        await db
          .prepare("UPDATE team_members SET role=?,updated_at=? WHERE email=?")
          .bind(p.role, now, p.email)
          .run();
        message = `${p.email} is now ${roleInfo[p.role].label}.`;
        await recordAccessEvent({
          actor,
          action: "role",
          target: p.email,
          detail: `${roleInfo[existing.role].label} → ${roleInfo[p.role].label}`,
        });
        break;
      }
      case "suspend":
      case "reactivate": {
        if (!existing) throw Error("Team member not found");
        const status = p.action === "suspend" ? "suspended" : "active";
        if (existing.status === status) {
          message = "No change.";
          break;
        }
        await db
          .prepare("UPDATE team_members SET status=?,updated_at=? WHERE email=?")
          .bind(status, now, p.email)
          .run();
        if (status === "suspended") await signOutEverywhere(p.email);
        message =
          status === "suspended"
            ? `${p.email} can no longer open the workspace.`
            : `${p.email} has access again.`;
        await recordAccessEvent({ actor, action: p.action, target: p.email, detail: "" });
        break;
      }
      case "remove": {
        if (!existing) throw Error("Team member not found");
        await db
          .prepare("DELETE FROM team_members WHERE email=?")
          .bind(p.email)
          .run();
        await signOutEverywhere(p.email);
        message = `${p.email} has been removed from the team.`;
        await recordAccessEvent({
          actor,
          action: "remove",
          target: p.email,
          detail: roleInfo[existing.role].label,
        });
        break;
      }
      case "reset": {
        if (p.email === actor)
          throw Error("Change your own password from My account.");
        if (!existing && !owners.includes(p.email))
          throw Error("Team member not found");
        if (existing?.status === "suspended")
          throw Error("Reactivate this person before sending a reset link.");
        if (!clerkReady())
          throw Error(
            authMode() === "clerk"
              ? "Add CLERK_SECRET_KEY to the deployment settings to send reset links."
              : "Passwords are managed by your sign-in service. Turn on Clerk sign-in (AUTH_MODE=clerk) to reset passwords from here.",
          );
        const { clerkSignInLink } = await import("@/lib/clerk-admin");
        const url = await clerkSignInLink(p.email, new URL(req.url).origin);
        if (!url)
          throw Error(
            "This person hasn't created their account yet. Ask them to sign up with this email address.",
          );
        const provider = emailProvider(c);
        let emailed = false;
        if (provider && c.EMAIL_FROM) {
          try {
            await sendEmail({
              provider,
              sender: c.EMAIL_FROM,
              to: [p.email],
              subject: "Reset your Em2 workspace password",
              text: [
                "Hello,",
                "",
                "Use this one-time link to sign in to the Em2 workspace. It works once and expires in 24 hours.",
                "",
                url,
                "",
                "Once you're signed in you'll land on My account, where you can set a new password.",
                "",
                "If you didn't expect this email you can ignore it.",
              ].join("\n"),
            });
            emailed = true;
          } catch (error) {
            console.error("Reset link email failed", error);
          }
        }
        if (emailed) message = `A reset link has been emailed to ${p.email}.`;
        else {
          link = url;
          message =
            "Email isn't available, so copy this one-time link and send it to them yourself. It expires in 24 hours.";
        }
        await recordAccessEvent({
          actor,
          action: "reset",
          target: p.email,
          detail: emailed ? "Emailed" : "Link shown to owner",
        });
        break;
      }
    }
    return Response.json(
      {
        message,
        link,
        members: await listTeamMembers(),
        events: await listAccessEvents(),
      },
      noStore,
    );
  } catch (e) {
    return errorResponse(e);
  }
}

async function signOutEverywhere(email: string) {
  if (!clerkReady()) return;
  try {
    const { revokeClerkSessions } = await import("@/lib/clerk-admin");
    await revokeClerkSessions(email);
  } catch (error) {
    // Access is refused on every request anyway; this only ends open sessions.
    console.error("Couldn't sign out sessions", error);
  }
}
