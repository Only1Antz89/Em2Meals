import { ZodError } from "zod";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { emptyState, type State, type Command, applyCommand } from "./domain";
import { sampleState } from "./sample";
export const config = () => env as unknown as Record<string, any>;
export function database() {
  const db = config().DB as D1Database | undefined;
  if (!db) throw Error("Database unavailable. Please try again later.");
  return db;
}
export async function owner() {
  const user = await getChatGPTUser();
  if (!user) return null;
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
  return { state: JSON.parse(row.data) as State, revision: row.revision };
}
export async function commitState(
  mode: string,
  state: State,
  revision: number,
) {
  const result = await database()
    .prepare(
      "UPDATE workspaces SET data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
    )
    .bind(
      JSON.stringify(state),
      new Date().toISOString(),
      mode === "sample" ? "sample" : "live",
      revision,
    )
    .run();
  if (result.meta.changes !== 1)
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
    email: !!(c.RESEND_API_KEY && c.EMAIL_FROM),
    owner: !!(c.OWNER_EMAILS || c.OWNER_IDS),
  };
}
export async function jsonBody(req: Request) {
  const raw = await req.text();
  if (raw.length > 100000) throw Error("Request is too large");
  return JSON.parse(raw);
}
