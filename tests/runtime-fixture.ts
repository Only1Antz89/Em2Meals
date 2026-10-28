import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
export const sqlite = new DatabaseSync(":memory:");
export function resetDB() {
  sqlite.exec(
    "DROP TABLE IF EXISTS workspaces; DROP TABLE IF EXISTS enquiries; DROP TABLE IF EXISTS rate_limits; DROP TABLE IF EXISTS email_deliveries; DROP TABLE IF EXISTS workspace_backups; DROP TABLE IF EXISTS enquiry_imports; DROP TABLE IF EXISTS research_cache; DROP TABLE IF EXISTS workspace_send_locks; DROP TABLE IF EXISTS crm_digest_deliveries; DROP TABLE IF EXISTS team_members; DROP TABLE IF EXISTS access_events;",
  );
  sqlite.exec(readFileSync("drizzle/0000_gorgeous_xorn.sql", "utf8"));
  sqlite.exec(readFileSync("drizzle/0001_operations.sql", "utf8"));
  sqlite.exec(readFileSync("drizzle/0002_crm.sql", "utf8"));
  sqlite.exec(readFileSync("drizzle/0003_hardening.sql", "utf8"));
  sqlite.exec(readFileSync("drizzle/0004_team_access.sql", "utf8"));
  testUser = { ...defaultUser };
}
class Statement {
  values: (string | number | null)[] = [];
  constructor(public sql: string) {}
  bind(...values: (string | number | null)[]) {
    this.values = values;
    return this;
  }
  async first<T>() {
    return (sqlite.prepare(this.sql).get(...this.values) as T) || null;
  }
  async all<T>() {
    return { results: sqlite.prepare(this.sql).all(...this.values) as T[] };
  }
  async run() {
    const result = sqlite.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes) } };
  }
}
export const env: Record<string, unknown> = {
  OWNER_EMAILS: "owner@example.com",
  SMTP2GO_API_KEY: "fake-key-for-mocked-fetch",
  EMAIL_FROM: "test@example.com",
  CRON_SECRET: "test-cron-secret",
  DB: {
    prepare: (sql: string) => new Statement(sql),
    batch: async (statements: Statement[]) => {
      sqlite.exec("BEGIN");
      try {
        const result = statements.map((s) => ({
          meta: {
            changes: Number(sqlite.prepare(s.sql).run(...s.values).changes),
          },
        }));
        sqlite.exec("COMMIT");
        return result;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  },
};
globalThis.__EM2_TEST_ENV__ = env;
globalThis.__EM2_TEST_DB__ = env.DB as typeof globalThis.__EM2_TEST_DB__;
const defaultUser = {
  email: "owner@example.com",
  userId: "test-owner",
  displayName: "owner@example.com",
  fullName: null as string | null,
};
let testUser: typeof defaultUser | null = { ...defaultUser };
// Signs the tests in as someone else (or nobody) until the next resetDB().
export function signInAs(email: string | null) {
  testUser = email
    ? { email, userId: `test-${email}`, displayName: email, fullName: null }
    : null;
}
export async function getChatGPTUser() {
  return testUser;
}
