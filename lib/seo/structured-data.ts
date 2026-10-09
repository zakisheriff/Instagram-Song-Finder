import { absoluteUrl, site } from "@/lib/site";

type JsonLd = Record<string, unknown>;

const ORGANIZATION_ID = `${site.publisher.url}/#organization`;
const WEBSITE_ID = absoluteUrl("/#website");
const WEBAPP_ID = absoluteUrl("/#webapp");

/** The Atom, the publisher of the site. */
export function organizationNode(): JsonLd {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: site.publisher.name,
    url: site.publisher.url,
  };
}

export function websiteNode(): JsonLd {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: site.name,
    alternateName: site.shortName,
    url: absoluteUrl("/"),
    description: site.description,
    inLanguage: site.locale,
    publisher: { "@id": ORGANIZATION_ID },
  };
}

/** Only factual properties: no ratings, reviews or usage figures. */
export function webApplicationNode(): JsonLd {
  return {
    "@type": "WebApplication",
    "@id": WEBAPP_ID,
    name: site.name,
    url: absoluteUrl("/"),
    description: site.description,
    applicationCategory: "MultimediaApplication",
    applicationSubCategory: "Music metadata lookup",
    operatingSystem: "Any",
    browserRequirements: "Requires a modern web browser with JavaScript enabled.",
    inLanguage: site.locale,
    isAccessibleForFree: true,
    featureList: [
      "Search songs by title, artist or keywords",
      "Look up a recording from a Spotify track link or URI",
      "Look up recordings by ISRC",
      "Copy the ISRC formatted for Instagram music search",
    ],
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@id": ORGANIZATION_ID },
    creator: { "@id": ORGANIZATION_ID },
  };
}

interface WebPageInput {
  path: string;
  name: string;
  description: string;
  type?: "WebPage" | "AboutPage";
  breadcrumb?: boolean;
}

export function webPageNode({ path, name, description, type = "WebPage", breadcrumb }: WebPageInput): JsonLd {
  const url = absoluteUrl(path);
  return {
    "@type": type,
    "@id": `${url}#webpage`,
    url,
    name,
    description,
    inLanguage: site.locale,
    isPartOf: { "@id": WEBSITE_ID },
    publisher: { "@id": ORGANIZATION_ID },
    ...(path === "/" && { mainEntity: { "@id": WEBAPP_ID } }),
    ...(breadcrumb && { breadcrumb: { "@id": `${url}#breadcrumb` } }),
  };
}

export function breadcrumbNode(path: string, name: string): JsonLd {
  return {
    "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(path)}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: site.name, item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name, item: absoluteUrl(path) },
    ],
  };
}

export function graph(...nodes: JsonLd[]): JsonLd {
  return { "@context": "https://schema.org", "@graph": nodes };
}

/** Structured data for the home page. */
export function homeGraph(): JsonLd {
  return graph(
    organizationNode(),
    websiteNode(),
    webApplicationNode(),
    webPageNode({ path: "/", name: site.title, description: site.description }),
  );
}

/** Structured data for an informational sub-page with a breadcrumb trail. */
export function subPageGraph(input: Omit<WebPageInput, "breadcrumb"> & { breadcrumbName: string }): JsonLd {
  const { breadcrumbName, ...page } = input;
  return graph(
    organizationNode(),
    websiteNode(),
    webPageNode({ ...page, breadcrumb: true }),
    breadcrumbNode(page.path, breadcrumbName),
  );
}
