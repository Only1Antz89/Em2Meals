import { getDb } from "@/db";
import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { authMode } from "./auth-mode";
import {
  can,
  isRole,
  normaliseEmail,
  permissionLabels,
  roleInfo,
  type Permission,
  type Role,
} from "./access";

export type Member = ChatGPTUser & {
  role: Role;
  // Where the role comes from: the deployment's owner list, the team list in
  // Settings, or demo mode (no sign-in at all).
  source: "deployment" | "team" | "demo";
};

export type TeamMember = {
  email: string;
  name: string;
  role: Role;
  status: "active" | "suspended";
  invitedBy: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string | null;
};

export type AccessEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
};

export class AccessDenied extends Error {}

// Double-quoted identifiers and inline constraints work on both Postgres
// (production) and SQLite (tests). Kept in step with
// drizzle-postgres/0002_team_access.sql.
const tableStatements = [
  `CREATE TABLE IF NOT EXISTS "team_members" (
    "email" text PRIMARY KEY NOT NULL,
    "name" text DEFAULT '' NOT NULL,
    "role" text NOT NULL,
    "status" text DEFAULT 'active' NOT NULL,
    "invited_by" text NOT NULL,
    "created_at" text NOT NULL,
    "updated_at" text NOT NULL,
    "last_seen_at" text,
    CONSTRAINT "team_members_role_valid" CHECK ("role" in ('owner', 'manager', 'kitchen', 'viewer')),
    CONSTRAINT "team_members_status_valid" CHECK ("status" in ('active', 'suspended'))
  )`,
  `CREATE TABLE IF NOT EXISTS "access_events" (
    "id" text PRIMARY KEY NOT NULL,
    "at" text NOT NULL,
    "actor" text NOT NULL,
    "action" text NOT NULL,
    "target" text NOT NULL,
    "detail" text DEFAULT '' NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "idx_access_events_at" ON "access_events" ("at")`,
];

// Database migrations aren't run by the build, so create the team tables the
// first time they're needed rather than failing every sign-in until someone
// runs them by hand.
let ensured: Promise<void> | undefined;
export function ensureTeamTables() {
  ensured ??= (async () => {
    const db = getDb();
    for (const statement of tableStatements) await db.prepare(statement).run();
  })().catch((error) => {
    ensured = undefined;
    throw error;
  });
  return ensured;
}

function listSetting(value: string | undefined, lower = false) {
  return String(value || "")
    .split(",")
    .map((x) => (lower ? x.trim().toLowerCase() : x.trim()))
    .filter(Boolean);
}

export function deploymentOwners(c: {
  OWNER_EMAILS?: string;
  OWNER_IDS?: string;
}) {
  return {
    emails: listSetting(c.OWNER_EMAILS, true),
    ids: listSetting(c.OWNER_IDS),
  };
}

type Row = {
  email: string;
  name: string;
  role: string;
  status: string;
  invited_by: string;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
};

function fromRow(row: Row): TeamMember {
  return {
    email: row.email,
    name: row.name,
    role: isRole(row.role) ? row.role : "viewer",
    status: row.status === "active" ? "active" : "suspended",
    invitedBy: row.invited_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
  };
}

export async function findTeamMember(email: string) {
  await ensureTeamTables();
  const row = await getDb()
    .prepare(
      "SELECT email,name,role,status,invited_by,created_at,updated_at,last_seen_at FROM team_members WHERE email=?",
    )
    .bind(normaliseEmail(email))
    .first<Row>();
  return row ? fromRow(row) : null;
}

export async function listTeamMembers() {
  await ensureTeamTables();
  const rows = await getDb()
    .prepare(
      "SELECT email,name,role,status,invited_by,created_at,updated_at,last_seen_at FROM team_members ORDER BY created_at",
    )
    .all<Row>();
  return rows.results.map(fromRow);
}

export async function listAccessEvents(limit = 50) {
  await ensureTeamTables();
  const rows = await getDb()
    .prepare(
      "SELECT id,at,actor,action,target,detail FROM access_events ORDER BY at DESC LIMIT ?",
    )
    .bind(limit)
    .all<AccessEvent>();
  return rows.results;
}

export async function recordAccessEvent(
  event: Omit<AccessEvent, "id" | "at">,
) {
  await ensureTeamTables();
  await getDb()
    .prepare(
      "INSERT INTO access_events(id,at,actor,action,target,detail) VALUES(?,?,?,?,?,?)",
    )
    .bind(
      crypto.randomUUID(),
      new Date().toISOString(),
      event.actor,
      event.action,
      event.target,
      event.detail.slice(0, 500),
    )
    .run();
}

const SEEN_INTERVAL_MS = 10 * 60 * 1000;

// The signed-in person and their role, or null when they have no access.
export async function resolveMember(
  user: ChatGPTUser | null,
  c: { OWNER_EMAILS?: string; OWNER_IDS?: string },
): Promise<Member | null> {
  if (!user) return null;
  if (authMode() === "demo") return { ...user, role: "owner", source: "demo" };
  const owners = deploymentOwners(c);
  if (
    owners.emails.includes(normaliseEmail(user.email)) ||
    owners.ids.includes(user.userId)
  )
    return { ...user, role: "owner", source: "deployment" };
  const member = await findTeamMember(user.email);
  if (!member || member.status !== "active") return null;
  const now = Date.now();
  if (
    !member.lastSeenAt ||
    now - Date.parse(member.lastSeenAt) > SEEN_INTERVAL_MS
  ) {
    // Best effort: a failed "last seen" write must never block access.
    await getDb()
      .prepare("UPDATE team_members SET last_seen_at=? WHERE email=?")
      .bind(new Date(now).toISOString(), member.email)
      .run()
      .catch(() => {});
  }
  return {
    ...user,
    displayName: member.name || user.displayName,
    role: member.role,
    source: "team",
  };
}

export async function currentMember(c: {
  OWNER_EMAILS?: string;
  OWNER_IDS?: string;
}) {
  return resolveMember(await getChatGPTUser(), c);
}

export function deniedMessage(member: Member | null, permission: Permission) {
  if (!member) return "Workspace access required";
  return `Your ${roleInfo[member.role].label} role doesn't include: ${permissionLabels[permission].toLowerCase()}. Ask an owner to change your role.`;
}

export function assertCan(member: Member | null, permission: Permission) {
  if (!member || !can(member.role, permission))
    throw new AccessDenied(deniedMessage(member, permission));
  return member;
}
