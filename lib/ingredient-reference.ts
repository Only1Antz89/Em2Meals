import type { Ingredient } from "./domain";
import { ingredientReferenceData } from "./ingredient-reference-data";

/** The 14 allergens that UK food law requires caterers to declare. */
export const ukAllergens = [
  "celery",
  "cereals containing gluten",
  "crustaceans",
  "eggs",
  "fish",
  "lupin",
  "milk",
  "molluscs",
  "mustard",
  "peanuts",
  "sesame",
  "soya",
  "sulphites",
  "tree nuts",
] as const;
export type UkAllergen = (typeof ukAllergens)[number];

export type ReferenceCategory = NonNullable<Ingredient["category"]>;

export type IngredientReference = {
  id: string;
  name: string;
  /** Lower-case names this entry should match, e.g. "mince", "minced beef". Plurals match automatically. */
  aliases: string[];
  category: ReferenceCategory;
  /** Chilled, ready-to-eat or raw foods that support bacterial growth. */
  highRisk?: boolean;
  shelfLife: {
    fridge?: string;
    freezer?: string;
    ambient?: string;
    opened?: string;
  };
  storage: string;
  /** Allergens the product always contains. */
  allergens: UkAllergen[];
  /** Allergens that depend on the brand or recipe, so the label must be checked. */
  checkLabel?: UkAllergen[];
  allergenNote?: string;
  cooking?: string;
  handling: string[];
  catering?: string[];
};

/** UK temperature rules every card links back to (FSA Safer Food, Better Business). */
export const ukFoodSafetyRules = [
  { label: "Fridge", value: "0–5°C (legal maximum 8°C)" },
  { label: "Freezer", value: "−18°C or colder" },
  { label: "Cook", value: "75°C core for 30 seconds (or 70°C for 2 minutes)" },
  { label: "Hot hold", value: "63°C or hotter" },
  { label: "Reheat", value: "75°C core, once only (82°C in Scotland)" },
  { label: "Cool", value: "Into the fridge within 90 minutes" },
] as const;

export const ingredientReferenceSources = [
  { title: "FSA — Safer Food, Better Business", url: "https://www.food.gov.uk/business-guidance/safer-food-better-business" },
  { title: "FSA — Allergen guidance for food businesses", url: "https://www.food.gov.uk/business-guidance/allergen-guidance-for-food-businesses" },
  { title: "FSA — Cooking your food", url: "https://www.food.gov.uk/safety-hygiene/cooking-your-food" },
] as const;

/** Fallback guidance by category, used when no specific entry matches. */
const categoryFallbacks: Record<ReferenceCategory, Omit<IngredientReference, "id" | "name" | "aliases" | "category">> = {
  meat: { highRisk: true, shelfLife: { fridge: "Raw: follow the use-by", freezer: "Up to 6 months for best quality" }, storage: "Bottom shelf of the fridge, covered, below ready-to-eat food.", allergens: [], checkLabel: ["cereals containing gluten", "sulphites"], cooking: "Whole cuts of beef and lamb can be served pink once the outside is seared. Minced, rolled, stuffed or processed meat must reach 75°C core.", handling: ["Use separate boards and utensils for raw meat.", "Wash hands after handling raw meat."] },
  poultry: { highRisk: true, shelfLife: { fridge: "Raw: 1–2 days or by the use-by", freezer: "Up to 9 months" }, storage: "Bottom shelf of the fridge, covered, below ready-to-eat food.", allergens: [], cooking: "Cook to 75°C core with no pink meat and clear juices.", handling: ["Do not wash raw poultry; it spreads Campylobacter.", "Defrost fully in the fridge before cooking."] },
  "fish & seafood": { highRisk: true, shelfLife: { fridge: "Raw: 1–2 days or by the use-by", freezer: "Up to 3 months" }, storage: "Coldest part of the fridge, covered, on the bottom shelf.", allergens: ["fish"], cooking: "Cook until the flesh is opaque and flakes easily (63°C+ core).", handling: ["Check for a fresh sea smell, firm flesh and bright eyes."] },
  vegetables: { shelfLife: { fridge: "Typically 3–7 days" }, storage: "Cool and dry, or in the salad drawer.", allergens: [], handling: ["Wash before use, especially if served raw.", "Keep away from raw meat."] },
  fruit: { shelfLife: { fridge: "Typically 3–7 days", ambient: "Firm fruit ripens at room temperature" }, storage: "Most fruit keeps longer chilled once ripe.", allergens: [], handling: ["Wash before serving."] },
  carbohydrates: { shelfLife: { ambient: "Dry goods: to the best-before" }, storage: "Sealed container in a cool, dry store, off the floor.", allergens: [], checkLabel: ["cereals containing gluten"], handling: ["Cool cooked starches within 90 minutes and chill."] },
  bakery: { shelfLife: { ambient: "2–4 days", freezer: "Up to 3 months" }, storage: "Airtight, at room temperature. Fridges make bread stale faster.", allergens: ["cereals containing gluten"], checkLabel: ["milk", "eggs", "sesame", "soya"], handling: ["Bakery items carry a high risk of sesame and nut cross-contact."] },
  dairy: { highRisk: true, shelfLife: { fridge: "Follow the use-by" }, storage: "Fridge at 0–5°C, covered.", allergens: ["milk"], handling: ["Keep chilled; do not leave out during service longer than needed."] },
  eggs: { shelfLife: { fridge: "To the best-before" }, storage: "In the fridge, in their box.", allergens: ["eggs"], cooking: "Use pasteurised egg for raw or lightly cooked dishes for vulnerable guests.", handling: ["Wash hands after handling shells."] },
  herbs: { shelfLife: { fridge: "3–7 days" }, storage: "Wrapped in damp paper in the fridge. Basil keeps better at cool room temperature.", allergens: [], handling: ["Wash and dry before use."] },
  spices: { shelfLife: { ambient: "1–2 years for best flavour" }, storage: "Airtight, cool, dark and dry.", allergens: [], checkLabel: ["mustard", "celery"], allergenNote: "Spice blends often contain mustard or celery.", handling: ["Label blends with their allergens."] },
  condiments: { shelfLife: { ambient: "Unopened: to the best-before", opened: "Follow the label; most need refrigerating" }, storage: "Fridge once opened unless the label says otherwise.", allergens: [], checkLabel: ["mustard", "eggs", "celery", "sulphites", "cereals containing gluten"], handling: ["Date-label jars when opened."] },
  "oils & fats": { shelfLife: { ambient: "Unopened: to the best-before" }, storage: "Cool, dark cupboard, sealed.", allergens: [], handling: ["Never pour fat down drains; use a licensed waste oil collector."] },
  liquids: { shelfLife: { ambient: "Unopened: to the best-before", opened: "Fridge, 2–3 days" }, storage: "Chill once opened.", allergens: [], checkLabel: ["celery", "cereals containing gluten"], handling: ["Date-label once opened."] },
  "plant proteins": { shelfLife: { ambient: "Dried/tinned: to the best-before", opened: "Fridge, 2–3 days in a covered container" }, storage: "Dry goods in sealed containers; chilled products in the fridge.", allergens: [], checkLabel: ["soya"], handling: ["Decant opened tins into a covered container."] },
  other: { shelfLife: {}, storage: "Store as the label directs.", allergens: [], handling: ["Check the label for allergens and storage instructions."] },
};

const normalise = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const matchers = ingredientReferenceData.flatMap((entry) =>
  [entry.name, ...entry.aliases].map((alias) => {
    const words = normalise(alias).split(" ").map(escape);
    // Allow a plural on every word ("burger buns", "chicken thighs", "tomatoes").
    const pattern = words.map((word) => `${word}(?:e?s)?`).join(" ");
    return { entry, length: alias.length, regex: new RegExp(`(?:^| )${pattern}(?: |$)`) };
  }),
);

/** Finds the reference entry for an ingredient name; the longest matching alias wins. */
export function findIngredientReference(name: string): IngredientReference | undefined {
  const text = normalise(name);
  if (!text) return undefined;
  let best: (typeof matchers)[number] | undefined;
  for (const matcher of matchers)
    if (matcher.regex.test(text) && (!best || matcher.length > best.length)) best = matcher;
  return best?.entry;
}

/** Returns specific guidance when known, otherwise general guidance for the ingredient's category. */
export function ingredientReferenceFor(name: string, category?: ReferenceCategory): { reference: IngredientReference; generic: boolean } {
  const reference = findIngredientReference(name);
  if (reference) return { reference, generic: false };
  const fallbackCategory = category || "other";
  return {
    generic: true,
    reference: { id: `category-${fallbackCategory}`, name, aliases: [], category: fallbackCategory, ...categoryFallbacks[fallbackCategory] },
  };
}

/** Maps a free-text allergen list (e.g. "Wheat, milk, egg") to the UK 14. */
export function parseAllergens(text: string): UkAllergen[] {
  const value = normalise(text);
  const found = new Set<UkAllergen>();
  const rules: [UkAllergen, RegExp][] = [
    ["celery", /\bceler(y|iac)\b/],
    ["cereals containing gluten", /\b(gluten|wheat|barley|rye|oats?|spelt|kamut|cereals?)\b/],
    ["crustaceans", /\b(crustaceans?|prawns?|shrimps?|crabs?|lobsters?|langoustines?|crayfish)\b/],
    ["eggs", /\beggs?\b/],
    ["fish", /\b(fish|anchov(y|ies)|salmon|cod|tuna)\b/],
    ["lupin", /\blupin\b/],
    ["milk", /\b(milk|dairy|lactose)\b/],
    ["molluscs", /\b(molluscs?|mussels?|oysters?|squid|octopus|clams?|scallops?|whelks?|snails?)\b/],
    ["mustard", /\bmustard\b/],
    ["peanuts", /\b(peanuts?|groundnuts?)\b/],
    ["sesame", /\bsesame\b/],
    ["soya", /\b(soya?|soy)\b/],
    ["sulphites", /\b(sulph|sulf)(ites?|ur dioxide)\b/],
    ["tree nuts", /\b(tree nuts?|nuts|almonds?|hazelnuts?|walnuts?|cashews?|pecans?|brazil nuts?|pistachios?|macadamias?)\b/],
  ];
  for (const [allergen, regex] of rules) if (regex.test(value)) found.add(allergen);
  return [...found];
}

export { ingredientReferenceData };
