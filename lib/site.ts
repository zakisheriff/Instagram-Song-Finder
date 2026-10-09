/** Single source of truth for names, URLs and descriptions used across the site. */
export const site = {
  name: "Instagram Song Finder",
  shortName: "Song Finder",
  url: "https://instagramsongfinder.theatom.lk",
  domain: "instagramsongfinder.theatom.lk",
  title: "Instagram Song Finder – Find Songs & Copy ISRC Codes",
  description:
    "Find songs for Instagram using a song name, artist, or Spotify link. Get the recording's ISRC code and copy it instantly for Instagram music search.",
  locale: "en",
  /** Fixed rather than computed so pages stay fully static. */
  copyrightYear: 2026,
  /** ISO date the public content last changed; used by the sitemap. */
  lastUpdated: "2026-10-09",
  keywords: [
    "Instagram Song Finder",
    "Instagram Music Finder",
    "Instagram ISRC Finder",
    "Spotify ISRC Finder",
    "Find ISRC from Spotify",
    "ISRC Song Search",
    "Instagram Reels Song Finder",
    "Instagram Story Music Finder",
  ],
  publisher: {
    name: "The Atom",
    url: "https://www.theatom.lk",
  },
  disclaimer:
    "Instagram Song Finder is an independent tool by The Atom. It is not affiliated with, endorsed by or sponsored by Instagram, Meta or Spotify.",
} as const;

export function absoluteUrl(path = "/"): string {
  return new URL(path, site.url).toString();
}
