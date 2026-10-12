import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

const pages: [path: string, priority: number, frequency: "weekly" | "monthly" | "yearly"][] = [
  ["", 1, "monthly"],
  ["/private-chef", 0.9, "monthly"],
  ["/corporate", 0.9, "monthly"],
  ["/menu", 0.8, "weekly"],
  ["/about", 0.7, "yearly"],
  ["/enquire", 0.8, "yearly"],
  ["/privacy", 0.3, "yearly"],
];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map(([path, priority, changeFrequency]) => ({
    url: `${siteUrl}${path}`,
    changeFrequency,
    priority,
  }));
}
