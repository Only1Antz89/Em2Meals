import { enquirySchema, uid } from "@/lib/domain";
import {
  database,
  errorResponse,
  jsonBody,
  sameOrigin,
  importEnquiries,
} from "@/lib/server";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await jsonBody(req);
    if (p.website)
      return Response.json({ error: "Unable to submit" }, { status: 400 });
    const key = String(p.requestKey || "");
    if (!/^[0-9a-f-]{36}$/.test(key)) throw Error("Invalid submission key");
    const details = enquirySchema.parse(p.details);
    details.requirements = details.requirements.map((r) => ({
      ...r,
      meal: "",
      reviewed: false,
    }));
    const payload = JSON.stringify(details);
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(payload),
        ),
      ),
    )
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    const db = database();
    const existing = await db
      .prepare("SELECT id,payload_hash FROM enquiries WHERE request_key=?")
      .bind(key)
      .first<{ id: string; payload_hash: string }>();
    if (existing) {
      if (existing.payload_hash !== hash)
        throw Error(
          "This submission key was already used. Reload before submitting a different enquiry.",
        );
      await importEnquiries().catch(() => undefined);
      return Response.json({
        reference: `ENQ-${existing.id.slice(0, 8).toUpperCase()}`,
      });
    }
    const ip = req.headers.get("cf-connecting-ip") || "local";
    const window = `${ip}:${Math.floor(Date.now() / 3600000)}`;
    const now = new Date();
    const expiresAt = new Date(
      Math.floor(now.getTime() / 3600000) * 3600000 + 3600000,
    ).toISOString();
    const bucket = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(window)),
      ),
    )
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    await db
      .prepare("DELETE FROM rate_limits WHERE expires_at<=?")
      .bind(now.toISOString())
      .run();
    const rate = await db
      .prepare(
        "INSERT INTO rate_limits(id,count,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1,expires_at=excluded.expires_at RETURNING count",
      )
      .bind(bucket, expiresAt)
      .first<{ count: number }>();
    if ((rate?.count || 0) > 20)
      return Response.json(
        { error: "Too many enquiries. Please try again later." },
        { status: 429 },
      );
    const id = uid();
    await db
      .prepare(
        "INSERT OR IGNORE INTO enquiries(id,request_key,payload_hash,payload,created_at) VALUES(?,?,?,?,?)",
      )
      .bind(id, key, hash, payload, new Date().toISOString())
      .run();
    const saved = await db
      .prepare("SELECT id,payload_hash FROM enquiries WHERE request_key=?")
      .bind(key)
      .first<{ id: string; payload_hash: string }>();
    if (!saved || saved.payload_hash !== hash)
      throw Error("Please reload and try again");
    await importEnquiries().catch(() => undefined);
    return Response.json(
      { reference: `ENQ-${saved.id.slice(0, 8).toUpperCase()}` },
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
