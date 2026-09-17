import { config } from "./server";

type GeminiPart = { text?: string };
type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    };
  }>;
};

const RETRYABLE_GEMINI_STATUSES = new Set([429, 500, 502, 503, 504]);

function geminiFailure(status: number) {
  if (status === 401 || status === 403)
    return "Gemini authentication failed. Check the server-side API key and its restrictions.";
  if (status === 404)
    return "Gemini model unavailable. Check GEMINI_MODEL in the deployment environment.";
  if (status === 429)
    return "Gemini is temporarily rate limited. Review manually or retry shortly.";
  return `Gemini request failed (${status}). Review manually or retry.`;
}

function retryDelay(response: Response) {
  const seconds = Number(response.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds >= 0
    ? Math.min(seconds * 1000, 2000)
    : 250;
}

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
export async function googleJSON(
  url: string,
  body: any,
  extra: Record<string, string> = {},
) {
  const apiKey = config().GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw Error("Google Maps setup required");
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
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
  schema?: Record<string, unknown>,
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
  const generationConfig: Record<string, unknown> = {
    temperature: 0.2,
    maxOutputTokens: 3000,
  };
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig,
  };
  if (schema)
    Object.assign(generationConfig, {
      responseMimeType: "application/json",
      responseSchema: schema,
    });
  if (grounded) body.tools = [{ google_search: {} }];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  let r: Response | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": c.GEMINI_API_KEY,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(35000),
    });
    if (r.ok || !RETRYABLE_GEMINI_STATUSES.has(r.status) || attempt === 1)
      break;
    await wait(retryDelay(r));
  }
  if (!r?.ok) throw Error(geminiFailure(r?.status || 503));
  const j = (await r.json()) as GeminiResponse;
  const candidate = j.candidates?.[0];
  const text = candidate?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!text) {
    const reason = candidate?.finishReason;
    throw Error(
      reason && reason !== "STOP"
        ? `Gemini returned no usable answer (${reason}). Review manually.`
        : "Gemini returned no usable answer. Review manually.",
    );
  }
  const sources = (candidate?.groundingMetadata?.groundingChunks || []).flatMap(
    (chunk) =>
      chunk.web?.uri && /^https:\/\//.test(chunk.web.uri)
        ? [{ title: chunk.web.title || "Source", url: chunk.web.uri }]
        : [],
  );
  return {
    text,
    sources: sources.filter(
      (source, index) =>
        sources.findIndex((candidate) => candidate.url === source.url) === index,
    ),
  };
}
