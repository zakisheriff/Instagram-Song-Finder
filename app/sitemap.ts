import type { MetadataRoute } from "next";
import { absoluteUrl, site } from "@/lib/site";

/** Only genuine, public, indexable pages. Search states and API routes are never listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = site.lastUpdated;
  return [
    { url: absoluteUrl("/"), lastModified, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/about"), lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/privacy"), lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/terms"), lastModified, changeFrequency: "yearly", priority: 0.2 },
  ];
}
