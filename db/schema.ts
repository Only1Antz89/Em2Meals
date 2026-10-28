import { sql } from "drizzle-orm";
import { check, pgTable, text, integer, index } from "drizzle-orm/pg-core";
export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
  revision: integer("revision").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});
export const enquiries = pgTable(
  "enquiries",
  {
    id: text("id").primaryKey(),
    requestKey: text("request_key").notNull().unique(),
    payloadHash: text("payload_hash").notNull(),
    payload: text("payload").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_enquiries_created").on(t.createdAt)],
);
export const rateLimits = pgTable("rate_limits", {
  id: text("id").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: text("expires_at").notNull(),
}, (t) => [
  check("rate_limits_count_positive", sql`${t.count} > 0`),
  index("idx_rate_limits_expires").on(t.expiresAt),
]);
export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: text("id").primaryKey(),
    status: text("status").notNull(),
    providerId: text("provider_id"),
    error: text("error"),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    check(
      "email_deliveries_status_valid",
      sql`${t.status} in ('sending', 'uncertain', 'failed', 'sent')`,
    ),
    index("idx_email_deliveries_status_updated").on(t.status, t.updatedAt),
  ],
);
export const workspaceBackups = pgTable("workspace_backups", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
  revision: integer("revision").notNull(),
  createdAt: text("created_at").notNull(),
});
export const enquiryImports = pgTable(
  "enquiry_imports",
  {
    enquiryId: text("enquiry_id")
      .primaryKey()
      .references(() => enquiries.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    error: text("error"),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    check(
      "enquiry_imports_status_valid",
      sql`${t.status} in ('pending', 'imported')`,
    ),
    index("idx_enquiry_imports_status_updated").on(t.status, t.updatedAt),
  ],
);
export const researchCache = pgTable(
  "research_cache",
  {
    id: text("id").primaryKey(),
    data: text("data").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  (t) => [index("idx_research_cache_expires").on(t.expiresAt)],
);
export const workspaceSendLocks = pgTable(
  "workspace_send_locks",
  {
    workspaceId: text("workspace_id")
      .primaryKey()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    draftId: text("draft_id").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  (t) => [index("idx_workspace_send_locks_expires").on(t.expiresAt)],
);
export const crmDigestDeliveries = pgTable(
  "crm_digest_deliveries",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(),
    recipient: text("recipient").notNull(),
    status: text("status").notNull(),
    providerId: text("provider_id"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(1),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    check(
      "crm_digest_deliveries_status_valid",
      sql`${t.status} in ('sending', 'uncertain', 'failed', 'sent')`,
    ),
    check("crm_digest_deliveries_attempts_positive", sql`${t.attempts} > 0`),
    index("idx_crm_digest_date_status").on(t.date, t.status),
  ],
);
// People who can open the owner workspace, besides the owners named in the
// OWNER_EMAILS / OWNER_IDS deployment settings.
export const teamMembers = pgTable(
  "team_members",
  {
    email: text("email").primaryKey(),
    name: text("name").notNull().default(""),
    role: text("role").notNull(),
    status: text("status").notNull().default("active"),
    invitedBy: text("invited_by").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    lastSeenAt: text("last_seen_at"),
  },
  (t) => [
    check(
      "team_members_role_valid",
      sql`${t.role} in ('owner', 'manager', 'kitchen', 'viewer')`,
    ),
    check(
      "team_members_status_valid",
      sql`${t.status} in ('active', 'suspended')`,
    ),
  ],
);
// A record of every change to team access.
export const accessEvents = pgTable(
  "access_events",
  {
    id: text("id").primaryKey(),
    at: text("at").notNull(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    target: text("target").notNull(),
    detail: text("detail").notNull().default(""),
  },
  (t) => [index("idx_access_events_at").on(t.at)],
);
