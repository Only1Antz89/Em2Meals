// Public origin used for canonical metadata, robots.txt and the sitemap.
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://em2-meals.vercel.app"
).replace(/\/$/, "");
