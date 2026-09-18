import { ZodError } from "zod";
import { getDb } from "@/db";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { authMode } from "./auth-mode";
import { emptyState, type State, type Command, applyCommand } from "./domain";
import { sampleState } from "./sample";
import { normaliseState, reconcileStock } from "./operations";
import { assertStateIntegrity, assertStateShape } from "./state-integrity";
declare global {
  var __EM2_TEST_ENV__: Record<string, unknown> | undefined;
}

export const config = () => {
  if (globalThis.__EM2_TEST_ENV__)
    return globalThis.__EM2_TEST_ENV__ as Record<
      string,
      string | undefined
    >;

  // Keep production variables as explicit property reads. Next.js can inline
  // these safely into server bundles, whereas passing the process.env object
  // through indirectly can leave serverless functions with an empty shim.
  return {
    CRON_SECRET: process.env.CRON_SECRET,
    EMAIL_FROM: process.env.EMAIL_FROM,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
    OWNER_EMAILS: process.env.OWNER_EMAILS,
    OWNER_IDS: process.env.OWNER_IDS,
    SMTP2GO_API_KEY: process.env.SMTP2GO_API_KEY,
  } satisfies Record<string, string | undefined>;
};
export function database() {
  return getDb();
}
export async function owner() {
  const user = await getChatGPTUser();
  if (!user) return null;
  if (authMode() === "demo") return user;
  const emails = String(config().OWNER_EMAILS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const ids = String(config().OWNER_IDS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return emails.includes(user.email.toLowerCase()) || ids.includes(user.userId)
    ? user
    : null;
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(req.url).origin)
    throw Error("Invalid request origin");
}
export async function loadState(mode = "live") {
  const id = mode === "sample" ? "sample" : "live";
  const db = database();
  let row = await db
    .prepare("SELECT data,revision FROM workspaces WHERE id=?")
    .bind(id)
    .first<{ data: string; revision: number }>();
  if (!row) {
    const state = id === "sample" ? sampleState() : emptyState();
    await db
      .prepare(
        "INSERT OR IGNORE INTO workspaces(id,data,revision,updated_at) VALUES(?,?,0,?)",
      )
      .bind(id, JSON.stringify(state), new Date().toISOString())
      .run();
    row = await db
      .prepare("SELECT data,revision FROM workspaces WHERE id=?")
      .bind(id)
      .first<{ data: string; revision: number }>();
  }
  if (!row) throw Error("Database unavailable");
  const original = JSON.parse(row.data) as unknown;
  assertStateShape(original);
  if (!original.schemaVersion || original.schemaVersion < 5) {
    await db
      .prepare(
        "INSERT OR IGNORE INTO workspace_backups(id,data,revision,created_at) VALUES(?,?,?,?)",
      )
      .bind(`${id}:before-v5`, row.data, row.revision, new Date().toISOString())
      .run();
  }
  // Sample workspaces are disposable demonstrations. Refresh an older sample
  // snapshot as a unit so the v5 recipe imagery, stock, purchasing history and
  // costing examples stay internally consistent. Live data is only normalised.
  const state =
    id === "sample" && (!original.schemaVersion || original.schemaVersion < 5)
      ? sampleState()
      : normaliseState(original);
  reconcileStock(state);
  assertStateIntegrity(state);
  if (id === "live" && state.drafts.length) {
    const deliveries = await db
      .prepare("SELECT id,status,updated_at FROM email_deliveries")
      .all<{
        id: string;
        status: "sending" | "uncertain" | "failed" | "sent";
        updated_at: string;
      }>();
    for (const delivery of deliveries.results) {
      const draft = state.drafts.find((d) => d.id === delivery.id);
      if (draft) {
        draft.deliveryStatus = delivery.status;
        if (delivery.status === "sent") draft.sentAt ||= delivery.updated_at;
      }
    }
  }
  return { state, revision: row.revision };
}
export async function commitState(
  mode: string,
  state: State,
  revision: number,
  sendLock?: string,
) {
  assertStateIntegrity(state);
  const result = await database()
    .prepare(
      "UPDATE workspaces SET data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND NOT EXISTS (SELECT 1 FROM workspace_send_locks WHERE workspace_id=? AND expires_at>? AND draft_id<>?)",
    )
    .bind(
      JSON.stringify(state),
      new Date().toISOString(),
      mode === "sample" ? "sample" : "live",
      revision,
      mode === "sample" ? "sample" : "live",
      new Date().toISOString(),
      sendLock || "",
    )
    .run();
  if (result.meta.changes !== 1)
    throw Error("Another change was saved. Reload and try again.");
  return revision + 1;
}

export async function commitStateAndDelivery(
  mode: string,
  state: State,
  revision: number,
  delivery: {
    id: string;
    status: "sending" | "uncertain" | "failed" | "sent";
    providerId?: string;
    error?: string;
  },
  sendLock?: string,
) {
  assertStateIntegrity(state);
  const db = database();
  const workspaceId = mode === "sample" ? "sample" : "live";
  const updatedAt = new Date().toISOString();
  const results = await db.batch([
    db
      .prepare(
        "UPDATE workspaces SET data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND NOT EXISTS (SELECT 1 FROM workspace_send_locks WHERE workspace_id=? AND expires_at>? AND draft_id<>?)",
      )
      .bind(
        JSON.stringify(state),
        updatedAt,
        workspaceId,
        revision,
        workspaceId,
        updatedAt,
        sendLock || "",
      ),
    db
      .prepare(
        "UPDATE email_deliveries SET status=?,provider_id=?,error=?,updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM workspaces WHERE id=? AND revision=? AND updated_at=?)",
      )
      .bind(
        delivery.status,
        delivery.providerId || null,
        delivery.error || null,
        updatedAt,
        delivery.id,
        workspaceId,
        revision + 1,
        updatedAt,
      ),
  ]);
  if (results[0]?.meta.changes !== 1 || results[1]?.meta.changes !== 1)
    throw Error("Another change was saved. Reload and try again.");
  return revision + 1;
}
export async function command(
  mode: string,
  c: Command,
  actor: string,
  expectedRevision: number,
) {
  const { state, revision } = await loadState(mode);
  if (state.commands.includes(c.id)) return { state, revision };
  if (revision !== expectedRevision)
    throw Error("Another change was saved. Reload and try again.");
  const next = applyCommand(state, c, actor);
  return { state: next, revision: await commitState(mode, next, revision) };
}
export async function readEnquiries() {
  const r = await database()
    .prepare(
      "SELECT id,payload,created_at FROM enquiries ORDER BY created_at DESC LIMIT 500",
    )
    .all<{ id: string; payload: string; created_at: string }>();
  return r.results.map((x) => ({
    id: x.id,
    details: JSON.parse(x.payload),
    createdAt: x.created_at,
  }));
}
export function errorResponse(e: unknown, status = 400) {
  const message =
    e instanceof ZodError
      ? e.issues
          .map((i) => {
            const field = i.path.join(" ").replace(/([a-z])([A-Z])/g, "$1 $2");
            return i.code === "invalid_enum_value"
              ? `Please choose a valid ${field}.`
              : `${field || "Details"}: ${i.message}`;
          })
          .join("\n")
      : e instanceof Error
        ? e.message
        : "Request failed";
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export function integrationStatus() {
  const c = config();
  return {
    gemini: !!c.GEMINI_API_KEY,
    maps: !!c.GOOGLE_MAPS_API_KEY,
    email: !!(c.SMTP2GO_API_KEY && c.EMAIL_FROM),
    owner: !!(c.OWNER_EMAILS || c.OWNER_IDS),
  };
}
export async function jsonBody(req: Request) {
  const raw = await req.text();
  if (raw.length > 100000) throw Error("Request is too large");
  return JSON.parse(raw);
}

export async function importEnquiries() {
  const db = database();
  const pending = await db
    .prepare(
      "SELECT e.id,e.payload FROM enquiries e LEFT JOIN enquiry_imports i ON i.enquiry_id=e.id WHERE i.status IS NULL OR i.status<>'imported' ORDER BY e.created_at LIMIT 100",
    )
    .all<{ id: string; payload: string }>();
  for (const e of pending.results) {
    await db
      .prepare(
        "INSERT OR IGNORE INTO enquiry_imports(enquiry_id,status,updated_at) VALUES(?,'pending',?)",
      )
      .bind(e.id, new Date().toISOString())
      .run();
    try {
      let done = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        const { state, revision } = await loadState("live");
        if (state.orders.some((o) => o.enquiryId === e.id)) {
          done = true;
          break;
        }
        const next = applyCommand(
          state,
          {
            id: `import-${e.id}`,
            type: "order",
            payload: {
              details: JSON.parse(e.payload),
              enquiryId: e.id,
              items: [],
              imported: true,
            },
          },
          "system:enquiry-import",
        );
        try {
          await commitState("live", next, revision);
          done = true;
          break;
        } catch {
          /* retry from the latest revision */
        }
      }
      if (!done) throw Error("Workspace busy; import will retry");
      await db
        .prepare(
          "UPDATE enquiry_imports SET status='imported',error=NULL,updated_at=? WHERE enquiry_id=?",
        )
        .bind(new Date().toISOString(), e.id)
        .run();
    } catch (error) {
      await db
        .prepare(
          "UPDATE enquiry_imports SET status='pending',error=?,updated_at=? WHERE enquiry_id=?",
        )
        .bind((error as Error).message, new Date().toISOString(), e.id)
        .run();
    }
  }
}
