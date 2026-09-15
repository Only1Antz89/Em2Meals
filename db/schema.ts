import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
  revision: integer("revision").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});
export const enquiries = sqliteTable(
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
export const rateLimits = sqliteTable("rate_limits", {
  id: text("id").primaryKey(),
  count: integer("count").notNull(),
});
export const emailDeliveries = sqliteTable("email_deliveries", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  providerId: text("provider_id"),
  error: text("error"),
  updatedAt: text("updated_at").notNull(),
});
export const workspaceBackups = sqliteTable("workspace_backups", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
  revision: integer("revision").notNull(),
  createdAt: text("created_at").notNull(),
});
export const enquiryImports = sqliteTable("enquiry_imports", {
  enquiryId: text("enquiry_id").primaryKey(),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  updatedAt: text("updated_at").notNull(),
});
export const researchCache = sqliteTable("research_cache", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
  expiresAt: text("expires_at").notNull(),
});
export const workspaceSendLocks = sqliteTable("workspace_send_locks", {
  workspaceId: text("workspace_id").primaryKey(),
  draftId: text("draft_id").notNull(),
  expiresAt: text("expires_at").notNull(),
});
export const crmDigestDeliveries = sqliteTable(
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
  (t) => [index("idx_crm_digest_date_status").on(t.date, t.status)],
);
