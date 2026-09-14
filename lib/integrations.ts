import { config } from "./server";
export async function googleJSON(
  url: string,
  body: any,
  extra: Record<string, string> = {},
) {
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": config().GOOGLE_MAPS_API_KEY,
      ...extra,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok)
    throw Error(
      `Google Maps request failed (${r.status}). Use a manual estimate or retry.`,
    );
  return r.json() as Promise<any>;
}
export async function gemini(
  prompt: string,
  system: string,
  schema?: any,
  grounded = false,
) {
  const c = config();
  if (!c.GEMINI_API_KEY)
    throw Error(
      "Gemini setup required. Your records are saved and can be reviewed manually.",
    );
  const model = String(c.GEMINI_MODEL || "gemini-3.8-flash");
  if (!/^[a-zA-Z0-9.-]+$/.test(model))
    throw Error("Invalid Gemini model configuration");
  const body: any = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 3000 },
  };
  if (schema)
    Object.assign(body.generationConfig, {
      responseMimeType: "application/json",
      responseSchema: schema,
    });
  if (grounded) body.tools = [{ google_search: {} }];
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": c.GEMINI_API_KEY,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(35000),
    },
  );
  if (!r.ok)
    throw Error(
      `Gemini request failed (${r.status}). Review manually or retry.`,
    );
  const j: any = await r.json();
  const candidate = j.candidates?.[0];
  const text = candidate?.content?.parts
    ?.map((p: any) => p.text || "")
    .join("");
  if (!text) throw Error("Gemini returned no usable answer. Review manually.");
  return {
    text,
    sources: (candidate.groundingMetadata?.groundingChunks || []).flatMap(
      (c: any) =>
        c.web?.uri && /^https:\/\//.test(c.web.uri)
          ? [{ title: c.web.title || "Source", url: c.web.uri }]
          : [],
    ),
  };
}
