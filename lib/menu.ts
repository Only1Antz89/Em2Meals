import { z } from "zod";
import type { Ingredient, Recipe, State } from "./domain";
import {
  menuAccents,
  menuBackgrounds,
  menuSeasons as seasons,
  menuTags,
  type MenuTheme,
  type PublicMenu,
  type Season,
} from "./menu-theme";
export type { MenuTheme, PublicMenu, Season };

// Seasonal website menus. Owners generate a draft from a season's recipes,
// edit it, then publish a frozen public projection. Internal recipe costs and
// ids never enter the published snapshot.

export const menuLimits = {
  sections: 30,
  dishesPerSection: 100,
  shortText: 200,
  longText: 4000,
  // Stored in pence: £10,000.
  maxPrice: 1000000,
} as const;
const short = z
  .string()
  .trim()
  .max(menuLimits.shortText, `Keep this under ${menuLimits.shortText} characters`);
const long = z
  .string()
  .max(menuLimits.longText, `Keep this under ${menuLimits.longText} characters`);
// Only same-site paths or https URLs (e.g. Vercel Blob uploads) are rendered.
export const isMenuImageUrl = (value: string) =>
  value.length <= 1000 &&
  (!value || /^\/(?!\/)/.test(value) || /^https:\/\//.test(value));
const imageUrl = z
  .string()
  .refine(isMenuImageUrl, "Images must be uploaded or chosen from the library")
  .default("");
const id = z.string().min(1).max(100);
const season = z.enum(seasons);
const tag = z.enum(menuTags.map((t) => t.value) as [string, ...string[]]);

const itemSchema = z.object({
  id,
  recipeId: z.string().max(100).optional(),
  name: short.min(1, "Every dish needs a name"),
  description: long.default(""),
  imageUrl,
  showImage: z.boolean().default(true),
  price: z
    .number({ invalid_type_error: "Enter the price as a number" })
    .int("Enter the price in pounds and pence")
    .nonnegative("Prices cannot be negative")
    .max(menuLimits.maxPrice, "Prices must be £10,000 or less")
    .nullable()
    .default(null),
  // Repeated tags are harmless but would show twice on the website.
  tags: z
    .array(tag)
    .max(menuTags.length)
    .default([])
    .transform((tags) => [...new Set(tags)]),
});
const sectionSchema = z.object({
  id,
  title: short.min(1, "Every section needs a title"),
  description: long.default(""),
  imageUrl,
  items: z
    .array(itemSchema)
    .max(
      menuLimits.dishesPerSection,
      `A section can hold up to ${menuLimits.dishesPerSection} dishes`,
    ),
});
const themeSchema: z.ZodType<MenuTheme, z.ZodTypeDef, unknown> = z.object({
  layout: z.enum(["classic", "two-column", "cards"]).default("classic"),
  background: z
    .object({
      kind: z.enum(["brand", "colour", "image"]),
      value: z.string().max(1000),
      overlay: z.number().min(0).max(0.9).default(0.35),
    })
    .superRefine((bg, ctx) => {
      const valid =
        bg.kind === "brand"
          ? bg.value in menuBackgrounds
          : bg.kind === "colour"
            ? /^#[0-9a-f]{6}$/i.test(bg.value)
            : imageUrl.safeParse(bg.value).success && !!bg.value;
      if (!valid)
        ctx.addIssue({ code: "custom", message: "Choose a valid background" });
    }),
  accent: z
    .enum(Object.keys(menuAccents) as [keyof typeof menuAccents])
    .default("gold"),
  heroImageUrl: imageUrl,
  fontScale: z.number().min(0.85).max(1.2).default(1),
});
const contentSchema = z.object({
  title: short.min(1, "Add a menu title"),
  intro: long.default(""),
  footerNote: long.default(""),
  showPrices: z.boolean().default(false),
  theme: themeSchema,
  sections: z
    .array(sectionSchema)
    .max(menuLimits.sections, `A menu can have up to ${menuLimits.sections} sections`),
});

export type MenuItem = z.infer<typeof itemSchema>;
export type MenuSection = z.infer<typeof sectionSchema>;
export type MenuContent = z.infer<typeof contentSchema>;
export type Menu = MenuContent & {
  id: string;
  year: number;
  season: Season;
  updatedAt: string;
  published?: PublicMenu;
  publishedAt?: string;
};

const newId = () => crypto.randomUUID();

export function currentSeason(date = new Date()): Season {
  const month = date.getMonth();
  return month >= 2 && month <= 4
    ? "Spring"
    : month >= 5 && month <= 7
      ? "Summer"
      : month >= 8 && month <= 10
        ? "Autumn"
        : "Winter";
}

export function seasonRecipes(s: State, year: number, name: Season) {
  return s.recipes.filter(
    (recipe) =>
      (recipe.status || "active") === "active" &&
      (recipe.collections || []).some(
        (collection) => collection.year === year && collection.season === name,
      ),
  );
}

const sectionOrder = ["Starters & sides", "Mains", "Desserts"] as const;
export function suggestedSection(s: State, recipe: Recipe) {
  const categories = new Set(
    recipe.lines.map(
      (line) =>
        s.ingredients.find((ingredient) => ingredient.id === line.ingredientId)
          ?.category,
    ),
  );
  if (
    ["meat", "poultry", "fish & seafood", "plant proteins"].some((c) =>
      categories.has(c as Ingredient["category"]),
    )
  )
    return "Mains";
  if (categories.has("fruit")) return "Desserts";
  return "Starters & sides";
}

// Recipe fields are free text owned by the recipe editor, so clamp them to the
// menu's own rules; a generated menu must always be saveable and publishable.
export function itemFromRecipe(recipe: Recipe): MenuItem {
  const image = recipe.imageUrl && isMenuImageUrl(recipe.imageUrl) ? recipe.imageUrl : "";
  return {
    id: newId(),
    recipeId: recipe.id,
    name: (recipe.name || "").trim().slice(0, menuLimits.shortText) || "Untitled dish",
    description: (recipe.variant || "").slice(0, menuLimits.longText),
    imageUrl: image,
    showImage: !!image,
    price: null,
    tags: [],
  };
}

export function generateMenu(
  s: State,
  year: number,
  name: Season,
  at = new Date().toISOString(),
): Menu {
  const sections = new Map<string, MenuSection>();
  for (const title of sectionOrder)
    sections.set(title, {
      id: newId(),
      title,
      description: "",
      imageUrl: "",
      items: [],
    });
  for (const recipe of seasonRecipes(s, year, name)) {
    const section = sections.get(suggestedSection(s, recipe))!;
    if (section.items.length < menuLimits.dishesPerSection)
      section.items.push(itemFromRecipe(recipe));
  }
  return {
    id: newId(),
    year,
    season: name,
    title: `${name} menu ${year}`,
    intro: `^ Seasonal dishes, thoughtfully made in London.`,
    footerNote:
      "Please tell us about any allergies or dietary requirements when you enquire. Dishes may change with the availability of seasonal produce.",
    showPrices: false,
    theme: {
      layout: "classic",
      background: { kind: "brand", value: "cream", overlay: 0.35 },
      accent: "gold",
      heroImageUrl: `/images/recipes/seasons/${name.toLowerCase()}.png`,
      fontScale: 1,
    },
    sections: [...sections.values()].filter((section) => section.items.length),
    updatedAt: at,
  };
}

// Add recipes newly placed in the season without touching owner edits.
// Returns how many dishes were added; recipes that would push a section or the
// menu past its limits are left out so the menu always stays saveable.
export function syncMenu(s: State, menu: Menu) {
  const present = new Set(
    menu.sections.flatMap((section) =>
      section.items.map((item) => item.recipeId).filter(Boolean),
    ),
  );
  const missing = seasonRecipes(s, menu.year, menu.season).filter(
    (recipe) => !present.has(recipe.id),
  );
  let added = 0;
  for (const recipe of missing) {
    const title = suggestedSection(s, recipe);
    let section = menu.sections.find((x) => x.title === title);
    if (!section) {
      if (menu.sections.length >= menuLimits.sections) continue;
      section = { id: newId(), title, description: "", imageUrl: "", items: [] };
      menu.sections.push(section);
    }
    if (section.items.length >= menuLimits.dishesPerSection) continue;
    section.items.push(itemFromRecipe(recipe));
    added++;
  }
  return added;
}

// Dishes whose recipe is no longer active in this season's collection.
export function staleItems(s: State, menu: Menu) {
  const active = new Set(seasonRecipes(s, menu.year, menu.season).map((r) => r.id));
  return menu.sections.flatMap((section) =>
    section.items.filter((item) => item.recipeId && !active.has(item.recipeId)),
  );
}

// Ingredient allergen labels are owner-maintained and unverified here; the
// editor shows them only as prompts to confirm dietary tags.
export function allergenHints(s: State, recipeId?: string) {
  const recipe = s.recipes.find((r) => r.id === recipeId);
  if (!recipe) return [];
  const labels = recipe.lines.flatMap((line) =>
    (s.ingredients.find((i) => i.id === line.ingredientId)?.allergens || "")
      .split(/[,;/]/)
      .map((x) => x.trim())
      .filter((x) => x && !/^none$/i.test(x)),
  );
  return [...new Set(labels.map((x) => x[0].toUpperCase() + x.slice(1)))];
}

export function publicMenu(menu: Menu | (MenuContent & { year: number; season: Season })): PublicMenu {
  return {
    year: menu.year,
    season: menu.season,
    title: menu.title,
    intro: menu.intro,
    footerNote: menu.footerNote,
    showPrices: menu.showPrices,
    theme: structuredClone(menu.theme),
    sections: menu.sections
      .filter((section) => section.items.length)
      .map((section) => ({
        title: section.title,
        description: section.description,
        imageUrl: section.imageUrl,
        items: section.items.map((item) => ({
          name: item.name,
          description: item.description,
          imageUrl: item.showImage ? item.imageUrl : "",
          price: menu.showPrices ? item.price : null,
          tags: [...item.tags],
        })),
      })),
  };
}

export function hasUnpublishedChanges(menu: Menu) {
  return (
    !!menu.published &&
    JSON.stringify(publicMenu(menu)) !== JSON.stringify(menu.published)
  );
}

export type MenuValidation =
  | { ok: true; content: MenuContent }
  | { ok: false; issues: string[] };

// Turns schema errors into messages an owner can act on, naming the section
// and dish ("Mains, dish 2: Every dish needs a name") instead of a raw path.
export function validateMenuContent(value: unknown): MenuValidation {
  const result = contentSchema.safeParse(value);
  if (result.success) return { ok: true, content: result.data };
  const raw = (value && typeof value === "object" ? value : {}) as {
    sections?: { title?: unknown; items?: { name?: unknown }[] }[];
  };
  const fieldNames: Record<string, string> = {
    title: "Menu title",
    intro: "Introduction",
    footerNote: "Footer note",
    description: "Description",
    name: "Dish name",
    imageUrl: "Photo",
    price: "Price",
    tags: "Dietary tags",
    theme: "Design",
  };
  const issues = result.error.issues.map((issue) => {
    const [first, sectionIndex, second, itemIndex, field] = issue.path;
    if (first === "sections" && typeof sectionIndex === "number") {
      const section = raw.sections?.[sectionIndex];
      const sectionTitle =
        typeof section?.title === "string" && section.title.trim()
          ? `“${section.title.trim()}”`
          : `Section ${sectionIndex + 1}`;
      if (second === "items" && typeof itemIndex === "number") {
        const name = section?.items?.[itemIndex]?.name;
        const dish =
          typeof name === "string" && name.trim() && field !== "name"
            ? `“${name.trim()}”`
            : `dish ${itemIndex + 1}`;
        return `${sectionTitle}, ${dish}: ${issue.message}`;
      }
      if (second === "items") return `${sectionTitle}: ${issue.message}`;
      return `${sectionTitle}: ${issue.message}`;
    }
    if (first === "theme") return `Design: ${issue.message}`;
    if (typeof first === "string" && fieldNames[first] && first !== "sections")
      return `${fieldNames[first]}: ${issue.message}`;
    return issue.message;
  });
  return { ok: false, issues: [...new Set(issues)] };
}

export function menuCommand(
  s: State,
  type: string,
  payload: unknown,
  at: string,
): string | undefined {
  if (!type.startsWith("menu-")) return undefined;
  s.menus ||= [];
  const p = z.record(z.unknown()).parse(payload);
  const find = () => {
    const menu = s.menus.find((m) => m.id === p.id);
    if (!menu) throw Error("Menu not found");
    return menu;
  };
  switch (type) {
    case "menu-generate": {
      const v = z
        .object({ year: z.number().int().min(2000).max(2100), season })
        .parse(p);
      if (s.menus.some((m) => m.year === v.year && m.season === v.season))
        throw Error(
          `A ${v.season} ${v.year} menu already exists. Use “Sync from recipes” to add new dishes.`,
        );
      const menu = generateMenu(s, v.year, v.season, at);
      if (!menu.sections.length)
        throw Error(
          `No active recipes are in the ${v.season} ${v.year} collection yet.`,
        );
      s.menus.push(menu);
      return menu.id;
    }
    case "menu-save": {
      const menu = find();
      // Optimistic check per menu: an editor that started from an older copy
      // (another tab or device saved since) must not silently overwrite it.
      if (typeof p.baseUpdatedAt === "string" && p.baseUpdatedAt !== menu.updatedAt)
        throw Error(
          "This menu was changed in another window. Reload to see the latest version before editing.",
        );
      const checked = validateMenuContent(p);
      if (!checked.ok) throw Error(checked.issues.join("\n"));
      const content = checked.content;
      const ids = [
        ...content.sections.map((x) => x.id),
        ...content.sections.flatMap((x) => x.items.map((i) => i.id)),
      ];
      if (new Set(ids).size !== ids.length)
        throw Error("Menu sections and dishes need unique ids");
      Object.assign(menu, content, { updatedAt: at });
      return menu.id;
    }
    case "menu-sync": {
      const menu = find();
      if (!syncMenu(s, menu))
        throw Error(
          `There are no new ${menu.season} ${menu.year} recipes to add, or the menu has reached its limit of ${menuLimits.dishesPerSection} dishes per section.`,
        );
      menu.updatedAt = at;
      return menu.id;
    }
    case "menu-publish": {
      const menu = find();
      if (!menu.sections.some((section) => section.items.length))
        throw Error("Add at least one dish before publishing");
      // Generated and synced content never passed through menu-save, so check
      // the whole menu against the same rules before it reaches the website.
      const checked = validateMenuContent(menu);
      if (!checked.ok)
        throw Error(`Fix these before publishing:\n${checked.issues.join("\n")}`);
      for (const other of s.menus)
        if (other.id !== menu.id) {
          delete other.published;
          delete other.publishedAt;
        }
      menu.published = publicMenu(menu);
      menu.publishedAt = at;
      return menu.id;
    }
    case "menu-unpublish": {
      const menu = find();
      delete menu.published;
      delete menu.publishedAt;
      return menu.id;
    }
    case "menu-delete": {
      const menu = find();
      s.menus = s.menus.filter((m) => m.id !== menu.id);
      return menu.id;
    }
    default:
      throw Error("Unknown menu action");
  }
}

export function liveMenu(s: Pick<State, "menus">) {
  return (s.menus || []).find((m) => m.published)?.published ?? null;
}
