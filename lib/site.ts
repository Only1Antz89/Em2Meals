// Public origin used for canonical metadata, robots.txt and the sitemap.
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://em2-meals.vercel.app"
).replace(/\/$/, "");

const siteName = "Fork Goodness Baked";
const shareImageAlt =
  "Fork Goodness Baked — private chef, corporate lunches and event catering";

// Per-page metadata for public pages. Next merges metadata shallowly, so a
// page that sets openGraph or twitter must repeat the shared fields too.
export function pageMetadata(path: string, title: string, description: string) {
  const socialTitle = title.replace(/\s*\|\s*Fork Goodness Baked$/, "");
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: socialTitle,
      description,
      url: path,
      siteName,
      type: "website" as const,
      locale: "en_GB",
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: shareImageAlt }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: socialTitle,
      description,
      images: [{ url: "/twitter-image", alt: shareImageAlt }],
    },
  };
}
