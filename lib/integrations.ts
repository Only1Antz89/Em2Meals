import { config } from "./server";

export type GeminiPart = {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
};
export type GeminiCandidate = {
  content?: { role?: string; parts?: GeminiPart[] };
  finishReason?: string;
  groundingMetadata?: {
    groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
  };
};
export type GeminiResponse = { candidates?: GeminiCandidate[] };

export class GeminiIntegrationError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GeminiIntegrationError";
    this.status = status;
  }
}

const RETRYABLE_GEMINI_STATUSES = new Set([429, 500, 502, 503, 504]);

function geminiFailure(status: number) {
  if (status === 401 || status === 403)
    return "AutoSous authentication failed. Check the server-side service key and its restrictions.";
  if (status === 404)
    return "AutoSous is unavailable. Check its model configuration in the deployment environment.";
  if (status === 429)
    return "AutoSous is temporarily rate limited. Review manually or retry shortly.";
  return `AutoSous request failed (${status}). Review manually or retry.`;
}

function retryDelay(response: Response, attempt = 0) {
  const seconds = Number(response.headers.get("retry-after"));
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 5000);
  }
  return Math.min(800 * Math.pow(2, attempt) + Math.floor(Math.random() * 400), 4000);
}

const wait = (milliseconds: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const aborted = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", aborted);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", aborted);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", aborted, { once: true });
    if (signal?.aborted) aborted();
  });
export async function googleJSON<T = Record<string, unknown>>(
  url: string,
  body: unknown,
  extra: Record<string, string> = {},
): Promise<T> {
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
  return r.json() as Promise<T>;
}
export type GeminiTurn = { role: "user" | "model"; parts: Record<string, unknown>[] };

const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
const FALLBACK_GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
];

// Gemini 3.x replaces thinkingBudget with thinkingLevel and ignores
// temperature, so neither is sent to those models. Flash-Lite defaults to
// minimal thinking, which ends multi-step tool use early; tool loops ask for
// medium. Older models keep their own defaults.
export function generationConfigFor(
  model: string,
  options: { schema?: Record<string, unknown>; toolUse?: boolean } = {},
) {
  const config: Record<string, unknown> = { maxOutputTokens: 8192 };
  const version = Number(model.match(/^gemini-(\d+(?:\.\d+)?)/)?.[1] || 0);
  if (version >= 3) {
    const lite = model.includes("flash-lite");
    config.thinkingConfig = {
      thinkingLevel: lite && !options.toolUse ? "minimal" : "medium",
    };
  } else {
    config.temperature = 0.2;
  }
  if (options.schema)
    Object.assign(config, {
      responseMimeType: "application/json",
      responseSchema: options.schema,
    });
  return config;
}

function geminiModels() {
  const configured = String(config().GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim();
  if (!/^[a-zA-Z0-9.-]+$/.test(configured))
    throw Error("Invalid AutoSous model configuration");
  return Array.from(new Set([configured, ...FALLBACK_GEMINI_MODELS]));
}

// Sends one generateContent request, trying the configured model and then
// the fallbacks when a model is missing, rejects the request shape or is busy.
export async function geminiGenerate(
  build: (model: string) => Record<string, unknown>,
  options: { searchFallback?: boolean; signal?: AbortSignal } = {},
): Promise<{ response: GeminiResponse; model: string }> {
  const c = config();
  if (!c.GEMINI_API_KEY)
    throw Error(
      "AutoSous setup required. Your records are saved and can be reviewed manually.",
    );
  const base = String(
    c.GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta",
  ).replace(/\/$/, "");
  let r: Response | undefined;
  let lastStatus = 503;
  for (const model of geminiModels()) {
    const body = build(model);
    const url = `${base}/models/${model}:generateContent`;
    for (let attempt = 0; attempt < 2; attempt++) {
      options.signal?.throwIfAborted();
      r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": c.GEMINI_API_KEY,
        },
        body: JSON.stringify(body),
        signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(35000)]) : AbortSignal.timeout(35000),
      });
      // Search grounding has its own quota: when only that is exhausted,
      // answer from the model without search rather than failing.
      if (r.status === 429 && options.searchFallback && body.tools) {
        delete body.tools;
        continue;
      }
      if (r.ok || !RETRYABLE_GEMINI_STATUSES.has(r.status)) break;
      await wait(retryDelay(r, attempt), options.signal);
    }
    if (r?.ok)
      return { response: (await r.json()) as GeminiResponse, model };
    lastStatus = r?.status || 503;
    if (r && r.status !== 404 && r.status !== 400 && !RETRYABLE_GEMINI_STATUSES.has(r.status)) break;
  }
  const status = r?.status || lastStatus;
  let detail = "";
  try {
    const j = (await r?.json()) as { error?: { message?: string } } | undefined;
    if (j?.error?.message) detail = ` ${j.error.message.slice(0, 200)}`;
  } catch {}
  if (detail) console.error(`AutoSous request failed (${status}):${detail}`);
  throw new GeminiIntegrationError(status, geminiFailure(status));
}

export async function gemini(
  prompt: string,
  system: string,
  schema?: Record<string, unknown>,
  grounded = false,
  signal?: AbortSignal,
) {
  const { response: j } = await geminiGenerate(
    (model) => {
      const body: Record<string, unknown> = {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: generationConfigFor(model, { schema }),
      };
      if (grounded) body.tools = [{ google_search: {} }];
      return body;
    },
    { searchFallback: grounded, signal },
  );
  const candidate = j.candidates?.[0];
  const text = candidate?.content?.parts
    ?.filter((part) => !part.thought)
    .map((part) => part.text || "")
    .join("")
    .trim();
  if (!text) {
    const reason = candidate?.finishReason;
    throw Error(
      reason && reason !== "STOP"
        ? `AutoSous returned no usable answer (${reason}). Review manually.`
        : "AutoSous returned no usable answer. Review manually.",
    );
  }
  return { text, sources: groundingSources(candidate) };
}

export function groundingSources(candidate: GeminiCandidate | undefined) {
  const sources = (candidate?.groundingMetadata?.groundingChunks || []).flatMap(
    (chunk) =>
      chunk.web?.uri && /^https:\/\//.test(chunk.web.uri)
        ? [{ title: chunk.web.title || "Source", url: chunk.web.uri }]
        : [],
  );
  return sources.filter(
    (source, index) =>
      sources.findIndex((candidate) => candidate.url === source.url) === index,
  );
}
