import { database } from "./server";
export async function rateLimit(req: Request, scope: string, max: number) {
  const now = new Date();
  const expiresAt = new Date(
    Math.floor(now.getTime() / 3600000) * 3600000 + 3600000,
  ).toISOString();
  const raw = `${scope}:${req.headers.get("cf-connecting-ip") || "local"}:${Math.floor(Date.now() / 3600000)}`;
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  const db = database();
  await db
    .prepare("DELETE FROM rate_limits WHERE expires_at<=?")
    .bind(now.toISOString())
    .run();
  const row = await db
    .prepare(
      "INSERT INTO rate_limits(id,count,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=rate_limits.count+1,expires_at=excluded.expires_at RETURNING count",
    )
    .bind(hash, expiresAt)
    .first<{ count: number }>();
  if ((row?.count || 0) > max)
    throw Error(
      "Lookup limit reached. Please try again later or enter the details manually.",
    );
}
