import { expect, test } from "./fixtures";

const ORIGIN = "https://instagramsongfinder.theatom.lk";

test.describe("search engine and answer engine readiness", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "markup is identical on every device");

  test("home page ships the required metadata", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Instagram Song Finder – Find Songs & Copy ISRC Codes");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      "Find songs for Instagram using a song name, artist, or Spotify link. Get the recording's ISRC code and copy it instantly for Instagram music search.",
    );
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(new URL(canonical!).href).toBe(`${ORIGIN}/`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "Instagram Song Finder");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", new RegExp(`^${ORIGIN}/opengraph-image`));
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    await expect(page.locator('link[rel="icon"][href^="/favicon.ico"]')).toHaveCount(1);
    await expect(page.locator('link[rel="icon"][href^="/icon.png"]')).toHaveCount(1);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /^\/apple-icon\.png/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText("Find songs on Instagram by their ISRC code.");
  });

  test("explanatory content is in the server-rendered HTML", async ({ request }) => {
    const html = await (await request.get("/")).text();
    for (const text of [
      "How to use an ISRC code on Instagram",
      "Frequently asked questions",
      "What is an ISRC?",
      "Does every Spotify song exist on Instagram?",
      "Select the correct recording",
    ]) {
      expect(html).toContain(text);
    }
    // The independence statement lives on the About page.
    expect(await (await request.get("/about")).text()).toContain("not affiliated with");
  });

  test("structured data is valid JSON-LD with the expected entities", async ({ page }) => {
    await page.goto("/");
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks).toHaveLength(1);
    const graph = JSON.parse(blocks[0]) as { "@context": string; "@graph": Array<Record<string, unknown>> };
    expect(graph["@context"]).toBe("https://schema.org");
    expect(graph["@graph"].map((node) => node["@type"])).toEqual([
      "Organization",
      "WebSite",
      "WebApplication",
      "WebPage",
    ]);

    await page.goto("/about");
    const about = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').allTextContents())[0],
    ) as { "@graph": Array<Record<string, unknown>> };
    expect(about["@graph"].map((node) => node["@type"])).toContain("BreadcrumbList");
  });

  test("each sub-page has its own title, description and canonical", async ({ page }) => {
    const seen = new Set<string>();
    for (const path of ["/about", "/privacy", "/terms"]) {
      await page.goto(path);
      const title = await page.title();
      const description = await page.locator('meta[name="description"]').getAttribute("content");
      expect(seen.has(title)).toBe(false);
      seen.add(title);
      expect(description!.length).toBeGreaterThan(50);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${ORIGIN}${path}`);
      await expect(page.locator("h1")).toHaveCount(1);
    }
  });

  test("robots.txt, sitemap.xml and the manifest are served", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /api/");
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);

    const sitemap = await (await request.get("/sitemap.xml")).text();
    const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
    expect(locations).toEqual([`${ORIGIN}/`, `${ORIGIN}/about`, `${ORIGIN}/privacy`, `${ORIGIN}/terms`]);

    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.name).toBe("Instagram Song Finder");

    for (const asset of [
      "/opengraph-image",
      "/favicon.ico",
      "/icon.png",
      "/apple-icon.png",
      "/logo.png",
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/icon-maskable-512.png",
      "/llms.txt",
    ]) {
      expect((await request.get(asset)).status(), asset).toBe(200);
    }
  });

  test("API routes are not indexable and unknown pages return 404", async ({ request }) => {
    const api = await request.get("/api/search?q=isrc:12345");
    expect(api.status()).toBe(400);
    expect(api.headers()["x-robots-tag"]).toContain("noindex");
    expect(api.headers()["cache-control"]).toBe("no-store");

    const missing = await request.get("/this-page-does-not-exist");
    expect(missing.status()).toBe(404);
    expect(await missing.text()).toContain("noindex");
  });

  test("security headers are set and no secret reaches the browser", async ({ page, request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-powered-by"]).toBeUndefined();

    const scripts: string[] = [];
    page.on("response", async (loaded) => {
      if (loaded.url().endsWith(".js")) scripts.push(await loaded.text().catch(() => ""));
    });
    await page.goto("/", { waitUntil: "networkidle" });
    const bundle = scripts.join("\n") + (await page.content());
    expect(bundle).not.toContain("SPOTIFY_CLIENT_SECRET");
    expect(bundle).not.toContain("accounts.spotify.com");
  });
});
