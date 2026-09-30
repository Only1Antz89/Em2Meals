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

const short = z.string().trim().max(200);
const long = z.string().max(4000);
// Only same-site paths or https URLs (e.g. Vercel Blob uploads) are rendered.
const imageUrl = z
  .string()
  .max(1000)
  .refine(
    (value) => !value || /^\/(?!\/)/.test(value) || /^https:\/\//.test(value),
    "Images must be uploaded or chosen from the library",
  )
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
  price: z.number().int().nonnegative().max(1000000).nullable().default(null),
  tags: z.array(tag).max(menuTags.length).default([]),
});
const sectionSchema = z.object({
  id,
  title: short.min(1, "Every section needs a title"),
  description: long.default(""),
  imageUrl,
  items: z.array(itemSchema).max(100),
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
  sections: z.array(sectionSchema).max(30),
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

function itemFromRecipe(recipe: Recipe): MenuItem {
  return {
    id: newId(),
    recipeId: recipe.id,
    name: recipe.name,
    description: recipe.variant,
    imageUrl: recipe.imageUrl || "",
    showImage: !!recipe.imageUrl,
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
  for (const recipe of seasonRecipes(s, year, name))
    sections.get(suggestedSection(s, recipe))!.items.push(itemFromRecipe(recipe));
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
export function syncMenu(s: State, menu: Menu) {
  const present = new Set(
    menu.sections.flatMap((section) =>
      section.items.map((item) => item.recipeId).filter(Boolean),
    ),
  );
  const missing = seasonRecipes(s, menu.year, menu.season).filter(
    (recipe) => !present.has(recipe.id),
  );
  for (const recipe of missing) {
    const title = suggestedSection(s, recipe);
    let section = menu.sections.find((x) => x.title === title);
    if (!section) {
      section = { id: newId(), title, description: "", imageUrl: "", items: [] };
      menu.sections.push(section);
    }
    section.items.push(itemFromRecipe(recipe));
  }
  return missing.length;
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
      const content = contentSchema.parse(p);
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
      syncMenu(s, menu);
      menu.updatedAt = at;
      return menu.id;
    }
    case "menu-publish": {
      const menu = find();
      if (!menu.sections.some((section) => section.items.length))
        throw Error("Add at least one dish before publishing");
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
