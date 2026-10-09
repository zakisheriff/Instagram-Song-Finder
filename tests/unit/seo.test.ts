import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { faqEntries } from "@/lib/content/faq";
import { howToSteps } from "@/lib/content/how-to";
import { pageMetadata } from "@/lib/seo/metadata";
import { homeGraph, subPageGraph } from "@/lib/seo/structured-data";
import { site } from "@/lib/site";

type Node = Record<string, unknown>;
const nodes = (graph: Record<string, unknown>) => graph["@graph"] as Node[];
const byType = (graph: Record<string, unknown>, type: string) =>
  nodes(graph).find((node) => node["@type"] === type)!;

describe("site configuration", () => {
  it("uses the production domain and required homepage copy", () => {
    expect(site.url).toBe("https://instagramsongfinder.theatom.lk");
    expect(site.title).toBe("Instagram Song Finder by The Atom – Find Songs & Copy ISRC Codes");
    expect(site.description).toBe(
      "Find songs for Instagram using a song name, artist, or Spotify link. Get the recording's ISRC code and copy it instantly for Instagram music search.",
    );
    expect(site.disclaimer).toMatch(/not affiliated with.*Instagram, Meta or Spotify/);
  });
});

describe("page metadata", () => {
  it("sets a canonical URL and matching social tags", () => {
    const metadata = pageMetadata({ title: "T", description: "D", path: "/about" });
    expect(metadata.alternates?.canonical).toBe("/about");
    expect(metadata.openGraph).toMatchObject({ url: "/about", siteName: site.name, title: "T" });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", title: "T" });
  });
});

describe("sitemap and robots", () => {
  it("lists only public, indexable https pages on the production domain", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual([
      "https://instagramsongfinder.theatom.lk/",
      "https://instagramsongfinder.theatom.lk/about",
      "https://instagramsongfinder.theatom.lk/privacy",
      "https://instagramsongfinder.theatom.lk/terms",
    ]);
    expect(urls.some((url) => url.includes("/api") || url.includes("?"))).toBe(false);
  });

  it("allows crawling but keeps API routes out", () => {
    const config = robots();
    expect(config.rules).toEqual([{ userAgent: "*", allow: "/", disallow: ["/api/"] }]);
    expect(config.sitemap).toBe("https://instagramsongfinder.theatom.lk/sitemap.xml");
  });

  it("describes an installable app with icons", () => {
    const config = manifest();
    expect(config).toMatchObject({ name: site.name, start_url: "/", display: "standalone" });
    expect(config.icons?.map((icon) => icon.sizes)).toEqual(["192x192", "512x512", "512x512"]);
  });
});

describe("structured data", () => {
  it("describes the website, web page, application and publisher on the home page", () => {
    const graph = homeGraph();
    expect(graph["@context"]).toBe("https://schema.org");
    expect(nodes(graph).map((node) => node["@type"])).toEqual([
      "Organization",
      "WebSite",
      "WebApplication",
      "WebPage",
    ]);

    expect(byType(graph, "Organization")).toMatchObject({ name: "The Atom" });
    expect(byType(graph, "WebSite")).toMatchObject({
      name: "Instagram Song Finder",
      url: "https://instagramsongfinder.theatom.lk/",
    });
    expect(byType(graph, "WebApplication")).toMatchObject({
      applicationCategory: "MultimediaApplication",
      image: "https://instagramsongfinder.theatom.lk/logo.png",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    });
  });

  it("never includes ratings, reviews or usage claims", () => {
    const serialized = JSON.stringify(homeGraph());
    for (const forbidden of ["aggregateRating", "review", "ratingValue", "interactionStatistic"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("adds a breadcrumb trail on sub-pages", () => {
    const graph = subPageGraph({
      path: "/about",
      name: "About",
      description: "About the tool",
      type: "AboutPage",
      breadcrumbName: "About",
    });
    const breadcrumb = byType(graph, "BreadcrumbList");
    expect(breadcrumb.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: site.name, item: "https://instagramsongfinder.theatom.lk/" },
      { "@type": "ListItem", position: 2, name: "About", item: "https://instagramsongfinder.theatom.lk/about" },
    ]);
    expect(byType(graph, "AboutPage").breadcrumb).toEqual({ "@id": breadcrumb["@id"] });
  });
});

describe("answer content", () => {
  it("covers the ten core questions with unique anchors and direct answers", () => {
    expect(faqEntries).toHaveLength(10);
    expect(new Set(faqEntries.map((entry) => entry.id)).size).toBe(10);
    for (const entry of faqEntries) {
      expect(entry.question.endsWith("?")).toBe(true);
      expect(entry.answer[0].length).toBeGreaterThan(60);
    }
  });

  it("explains the seven steps without promising availability", () => {
    expect(howToSteps).toHaveLength(7);
    const text = JSON.stringify([howToSteps, faqEntries]).toLowerCase();
    expect(text).not.toMatch(/guaranteed to work|always works|works for every/);
    expect(text).toContain("cannot tell you whether instagram carries");
  });
});
