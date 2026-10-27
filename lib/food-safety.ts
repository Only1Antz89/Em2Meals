// UK Food Standards Agency alerts (product recalls and allergy alerts).
//
// Alerts come from the FSA's open data API (data.food.gov.uk), which is made
// for machines. The www.food.gov.uk RSS feeds are only a fallback: that site
// turns away requests from servers, which is why the feed showed as
// unreachable on the live site. Alerts are read at most twice a day and
// cached in the research cache table, so opening the app never waits long on
// them. News is shown as a weekly digest; an alert that names an ingredient
// in the catalogue is raised straight away as a warning.
import { database } from "./server";
import type { State } from "./domain";

export const FOOD_SAFETY_FEEDS = [
  { kind: "food" as const, url: "https://www.food.gov.uk/rss-feed/alerts-food" },
  { kind: "allergy" as const, url: "https://www.food.gov.uk/rss-feed/alerts-allergy" },
];
const ALERTS_API = process.env.FSA_ALERTS_API || "https://data.food.gov.uk/food-alerts/id";
// How far back to read alerts.
const ALERT_DAYS = 60;
const USER_AGENT = "Em2Meals/1.0 (catering kitchen food safety alerts)";
const CACHE_KEY = "autosous:food-safety-feeds";
const CACHE_HOURS = 12;

export type FoodSafetyItem = {
  id: string;
  kind: "food" | "allergy";
  title: string;
  summary: string;
  url: string;
  published: string;
};
export type FoodSafetyFeed = {
  items: FoodSafetyItem[];
  checkedAt: string;
  error?: string;
};

const entities = (text: string) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
// Feeds often escape their HTML descriptions, sometimes twice, so entities
// are decoded before and after the tags are removed.
const decode = (text: string) =>
  entities(entities(text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")).replace(/<[^>]+>/g, " "))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const tag = (block: string, name: string) => {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return match ? decode(match[1]) : "";
};

// Reads RSS 2.0 <item> or Atom <entry> elements. Only https links are kept.
export function parseFeed(xml: string, kind: FoodSafetyItem["kind"]): FoodSafetyItem[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.flatMap((block) => {
    const title = tag(block, "title");
    const atomLink = block.match(/<link[^>]*href="([^"]+)"/i)?.[1] || "";
    const url = (tag(block, "link") || atomLink).trim();
    if (!title || !/^https:\/\//.test(url)) return [];
    const date = tag(block, "pubDate") || tag(block, "updated") || tag(block, "published") || tag(block, "dc:date");
    const parsed = Date.parse(date);
    return [
      {
        id: tag(block, "guid") || tag(block, "id") || url,
        kind,
        title: title.slice(0, 300),
        summary: (tag(block, "description") || tag(block, "summary")).slice(0, 600),
        url,
        published: Number.isFinite(parsed) ? new Date(parsed).toISOString() : "",
      },
    ];
  });
}

type ApiLabel = { label?: string } | string;
type ApiAlert = {
  "@id"?: string;
  notation?: string;
  title?: string;
  shortTitle?: string;
  type?: string[] | string;
  created?: string;
  modified?: string;
  alertURL?: string;
  problem?: { riskStatement?: string; allergen?: ApiLabel[] | ApiLabel }[] | { riskStatement?: string; allergen?: ApiLabel[] | ApiLabel };
  productDetails?: { productName?: string }[] | { productName?: string };
};
const list = <T,>(v: T | T[] | undefined): T[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const label = (v: ApiLabel) => (typeof v === "string" ? v : v.label || "");

// Reads the FSA food alerts API. Allergy alerts (AA) are "allergy"; product
// recalls (PRIN) and action alerts (FAFA) are "food".
export function parseAlerts(json: unknown): FoodSafetyItem[] {
  const items = ((json as { items?: ApiAlert[] })?.items || []) as ApiAlert[];
  return items.flatMap((a) => {
    const url = a.alertURL || (a.notation ? `https://www.food.gov.uk/news-alerts/alert/${a.notation}` : "");
    const title = (a.title || a.shortTitle || "").trim();
    if (!title || !/^https:\/\//.test(url)) return [];
    const types = list(a.type).map(String);
    const problems = list(a.problem);
    const allergens = [...new Set(problems.flatMap((p) => list(p.allergen).map(label)).filter(Boolean))];
    const products = list(a.productDetails).map((p) => p.productName || "").filter(Boolean);
    const summary = [
      problems.map((p) => p.riskStatement || "").filter(Boolean).join(" "),
      products.length ? `Products: ${products.slice(0, 6).join("; ")}.` : "",
      allergens.length ? `Allergens: ${allergens.join(", ")}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const parsed = Date.parse(a.modified || a.created || "");
    return [
      {
        id: a.notation || a["@id"] || url,
        kind: types.some((t) => /\/AA$|^AA$/.test(t)) ? ("allergy" as const) : ("food" as const),
        title: title.slice(0, 300),
        summary: decode(summary).slice(0, 600),
        url,
        published: Number.isFinite(parsed) ? new Date(parsed).toISOString() : "",
      },
    ];
  });
}

async function fromApi(now: Date): Promise<FoodSafetyItem[]> {
  const since = new Date(now.getTime() - ALERT_DAYS * 86400000).toISOString().slice(0, 10);
  const r = await fetch(`${ALERTS_API}?since=${since}&_limit=100`, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw Error(`FSA alerts API HTTP ${r.status}`);
  return parseAlerts(await r.json());
}

async function fromRss(): Promise<FoodSafetyItem[]> {
  const results = await Promise.allSettled(
    FOOD_SAFETY_FEEDS.map(async (feed) => {
      const r = await fetch(feed.url, {
        headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) throw Error(`HTTP ${r.status}`);
      return parseFeed(await r.text(), feed.kind);
    }),
  );
  const ok = results.filter((r) => r.status === "fulfilled");
  if (!ok.length) throw Error(`FSA RSS feeds failed (${results.map((r) => (r.status === "rejected" ? String(r.reason?.message || r.reason) : "")).join(", ")})`);
  return ok.flatMap((r) => (r as PromiseFulfilledResult<FoodSafetyItem[]>).value);
}

export async function foodSafetyFeed(): Promise<FoodSafetyFeed> {
  const db = database();
  const now = new Date();
  const cached = await db
    .prepare("SELECT data FROM research_cache WHERE id=? AND expires_at>?")
    .bind(CACHE_KEY, now.toISOString())
    .first<{ data: string }>();
  if (cached) return JSON.parse(cached.data) as FoodSafetyFeed;
  let found: FoodSafetyItem[] = [];
  let failed = false;
  try {
    found = await fromApi(now);
  } catch (apiError) {
    console.warn("FSA alerts API failed, trying the RSS feeds", apiError);
    try {
      found = await fromRss();
    } catch (rssError) {
      console.error("FSA alerts could not be read", rssError);
      failed = true;
    }
  }
  const seen = new Set<string>();
  const items = found
    .filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
    .sort((a, b) => b.published.localeCompare(a.published))
    .slice(0, 40);
  const feed: FoodSafetyFeed = {
    items,
    checkedAt: now.toISOString(),
    ...(failed ? { error: "The Food Standards Agency feed could not be reached. AutoSous will try again later." } : {}),
  };
  // A failed check is retried sooner than a good one.
  const hours = failed ? 1 : CACHE_HOURS;
  await db
    .prepare(
      "INSERT INTO research_cache(id,data,expires_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at",
    )
    .bind(CACHE_KEY, JSON.stringify(feed), new Date(now.getTime() + hours * 3600000).toISOString())
    .run();
  return feed;
}

const GENERIC_WORDS = new Set([
  "mixed", "fresh", "plain", "whole", "frozen", "dried", "chopped", "sliced",
  "large", "small", "free", "range", "organic", "seeded", "smoked", "baby",
  "light", "dark", "white", "black", "green", "sweet", "fine", "ground",
  "extra", "virgin", "double", "single", "stock", "sauce", "mince", "fillet",
  "fillets", "breast", "thighs", "pieces", "leaves",
]);
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Which catalogue ingredients an alert mentions, by whole word, so "chicken"
// matches "Chicken breast fillets" but "egg" does not match "eggplant".
export function alertMatches(s: State, item: FoodSafetyItem) {
  const text = `${item.title} ${item.summary}`;
  return s.ingredients.filter((ingredient) => {
    const words = ingredient.name
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word.length >= 4 && !GENERIC_WORDS.has(word));
    const phrase = ingredient.name.trim();
    if (phrase.length >= 4 && new RegExp(`\\b${escape(phrase)}\\b`, "i").test(text)) return true;
    // A single distinctive word (e.g. "chicken" from "Chicken thighs").
    return words.length > 0 && new RegExp(`\\b${escape(words[0])}s?\\b`, "i").test(text);
  });
}
