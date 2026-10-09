import { readFileSync } from "node:fs";
import path from "node:path";
import { test as base, expect, type Page, type Route } from "@playwright/test";

// Playwright runs from the project root.
const ARTWORK = readFileSync(path.join(process.cwd(), "public/icons/icon-192.png"));

export const TRACK = {
  id: "spotify:2plbrEY59IikOBgBGLjaoe",
  provider: "spotify",
  title: "Die With A Smile",
  artists: ["Lady Gaga", "Bruno Mars"],
  album: "Die With A Smile",
  artworkUrl: "https://i.scdn.co/image/ab67616d00001e02test",
  isrc: "USUM72409273",
  durationMs: 251667,
  releaseDate: "2024-08-16",
  explicit: false,
  url: "https://open.spotify.com/track/2plbrEY59IikOBgBGLjaoe",
  versionTags: [] as string[],
};

export const LIVE_TRACK = {
  ...TRACK,
  id: "spotify:3ZCTVFBt2Brf31RLEnCkWJ",
  title: "Die With A Smile (Live in Las Vegas, with a deliberately long title to test wrapping)",
  isrc: "USUM72412854",
  versionTags: ["Live"],
};

export const NO_ISRC_TRACK = {
  ...TRACK,
  id: "spotify:4cOdK2wGLETKBW3PvgPWqT",
  title: "Unreleased Demo",
  isrc: null,
};

export function results(tracks: unknown[], extra: Record<string, unknown> = {}) {
  return {
    status: 200,
    body: {
      ok: true,
      kind: "text",
      query: "die with a smile",
      provider: { id: "spotify", name: "Spotify" },
      tracks,
      nextOffset: null,
      total: tracks.length,
      ...extra,
    },
  };
}

export function failure(status: number, code: string, message: string) {
  return { status, body: { ok: false, error: { code, message } } };
}

interface Mocks {
  /** Answers every `/api/search` call with the given payload and records the requested URLs. */
  mockSearch: (response: { status: number; body: unknown }) => Promise<string[]>;
  /** Text handed to the clipboard by the page. */
  copied: () => Promise<string[]>;
}

export const test = base.extend<Mocks>({
  page: async ({ page }, provide) => {
    // Album artwork never leaves the machine during tests.
    await page.route("https://i.scdn.co/**", (route: Route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: ARTWORK }),
    );
    // Record clipboard writes instead of depending on per-browser permissions.
    await page.addInitScript(() => {
      const copied: string[] = [];
      Object.defineProperty(window, "__copied", { value: copied });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            copied.push(text);
          },
        },
      });
    });
    await provide(page);
  },

  mockSearch: async ({ page }, provide) => {
    await provide(async (response) => {
      const requested: string[] = [];
      await page.unroute("**/api/search?**").catch(() => undefined);
      await page.route("**/api/search?**", (route: Route) => {
        requested.push(route.request().url());
        return route.fulfill({
          status: response.status,
          contentType: "application/json",
          body: JSON.stringify(response.body),
        });
      });
      return requested;
    });
  },

  copied: async ({ page }, provide) => {
    await provide(() => page.evaluate(() => (window as unknown as { __copied: string[] }).__copied));
  },
});

export { expect };

export const searchBox = (page: Page) =>
  page.getByRole("searchbox", { name: "Song, artist, Spotify link or ISRC" });

export const isPhoneLayout = (page: Page) => (page.viewportSize()?.width ?? 0) <= 875;

/** Fails when any part of the page is wider than the viewport. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(0);
}
