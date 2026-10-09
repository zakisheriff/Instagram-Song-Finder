import type { Metadata } from "next";
import { site } from "@/lib/site";

interface PageMetadataInput {
  /** Full `<title>` text. */
  title: string;
  description: string;
  /** Site-relative path, e.g. `/about`. */
  path: string;
}

/** Builds consistent title, description, canonical and social tags for a page. */
export function pageMetadata({ title, description, path }: PageMetadataInput): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      siteName: site.name,
      title,
      description,
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
