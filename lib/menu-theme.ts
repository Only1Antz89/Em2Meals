// Dependency-free menu presentation constants and types, shared by the public
// menu page, the admin preview and the menu domain logic.

export const menuSeasons = ["Spring", "Summer", "Autumn", "Winter"] as const;
export type Season = (typeof menuSeasons)[number];

export const menuTags = [
  { value: "V", label: "Vegetarian" },
  { value: "VG", label: "Vegan" },
  { value: "GF", label: "Gluten free" },
  { value: "DF", label: "Dairy free" },
  { value: "NF", label: "Nut free" },
  { value: "SPICY", label: "Spicy" },
] as const;
export const menuLayouts = [
  { value: "classic", label: "Classic", hint: "Centred, one column" },
  { value: "two-column", label: "Two column", hint: "Sections side by side" },
  { value: "cards", label: "Cards", hint: "Dish photos in a grid" },
] as const;
// Brand-safe palettes. Custom background colours are allowed, but text tone is
// derived from contrast so the menu stays legible.
export const menuBackgrounds = {
  cream: { label: "Cream", colour: "#faf8f2" },
  stone: { label: "Stone", colour: "#e8e5de" },
  sage: { label: "Sage", colour: "#e3e8e1" },
  blue: { label: "Slate blue", colour: "#405763" },
  navy: { label: "Navy", colour: "#1f3039" },
  ink: { label: "Ink", colour: "#18252c" },
} as const;
export const menuAccents = {
  gold: { label: "Gold", colour: "#ad8955" },
  terracotta: { label: "Terracotta", colour: "#b77756" },
  sage: { label: "Sage", colour: "#6c8b85" },
  navy: { label: "Navy", colour: "#254957" },
} as const;
export const menuImageLibrary = [
  "/images/private-dining-hero.jpg",
  "/images/private-dining.jpg",
  "/images/corporate-catering-hero.jpg",
  "/images/corporate-spread.jpg",
  "/images/desserts.jpg",
  "/images/breakfast.jpg",
  "/images/food-prep.jpg",
  "/images/chef.jpg",
  "/images/recipes/seasons/spring.png",
  "/images/recipes/seasons/summer.png",
  "/images/recipes/seasons/autumn.png",
  "/images/recipes/seasons/winter.png",
];

export type MenuLayout = (typeof menuLayouts)[number]["value"];
export type MenuTheme = {
  layout: MenuLayout;
  background: {
    kind: "brand" | "colour" | "image";
    value: string;
    overlay: number;
  };
  accent: keyof typeof menuAccents;
  heroImageUrl: string;
  fontScale: number;
};
export type PublicMenu = {
  year: number;
  season: Season;
  title: string;
  intro: string;
  footerNote: string;
  showPrices: boolean;
  theme: MenuTheme;
  sections: {
    title: string;
    description: string;
    imageUrl: string;
    items: {
      name: string;
      description: string;
      imageUrl: string;
      price: number | null;
      tags: string[];
    }[];
  }[];
};

// Image backgrounds always sit under a dark overlay of at least this strength.
export const minimumImageOverlay = 0.25;

export function menuBackgroundColour(theme: MenuTheme) {
  const { kind, value } = theme.background;
  if (kind === "brand")
    return (
      menuBackgrounds[value as keyof typeof menuBackgrounds]?.colour ??
      menuBackgrounds.cream.colour
    );
  if (kind === "colour") return value;
  return menuBackgrounds.ink.colour;
}

// "dark" means a dark background with light text.
export function menuTone(theme: MenuTheme): "light" | "dark" {
  if (theme.background.kind === "image") return "dark";
  const hex = menuBackgroundColour(theme).replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "light" : "dark";
}

export function formatMenuPrice(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: pence % 100 ? 2 : 0,
  }).format(pence / 100);
}
