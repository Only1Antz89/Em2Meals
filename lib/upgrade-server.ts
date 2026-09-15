import { database } from "./server";
// Additive infrastructure is safe for existing deployed workspaces. The checked-in
// migration also provisions these tables before rollout; no existing columns change.
export async function ensureOperationsTables() {
  const db = database();
  await db.batch([
    db.prepare(
      "CREATE TABLE IF NOT EXISTS workspace_backups (id TEXT PRIMARY KEY, data TEXT NOT NULL, revision INTEGER NOT NULL, created_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS enquiry_imports (enquiry_id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'pending', error TEXT, updated_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS research_cache (id TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS workspace_send_locks (workspace_id TEXT PRIMARY KEY, draft_id TEXT NOT NULL, expires_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS crm_digest_deliveries (id TEXT PRIMARY KEY, date TEXT NOT NULL, recipient TEXT NOT NULL, status TEXT NOT NULL, provider_id TEXT, error TEXT, attempts INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_crm_digest_date_status ON crm_digest_deliveries(date,status)",
    ),
  ]);
}
export async function rateLimit(req: Request, scope: string, max: number) {
  const raw = `${scope}:${req.headers.get("cf-connecting-ip") || "local"}:${Math.floor(Date.now() / 3600000)}`;
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  const row = await database()
    .prepare(
      "INSERT INTO rate_limits(id,count) VALUES(?,1) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count",
    )
    .bind(hash)
    .first<{ count: number }>();
  if ((row?.count || 0) > max)
    throw Error(
      "Lookup limit reached. Please try again later or enter the details manually.",
    );
}
