import { readJson, request } from "@/lib/http/request";

/** Services whose links can only be turned into a title, via their public oEmbed endpoint. */
export type TitleLinkService = "youtube" | "soundcloud";

export const TITLE_LINK_SERVICE_NAMES: Record<TitleLinkService, string> = {
  youtube: "YouTube",
  soundcloud: "SoundCloud",
};

/** Fixed, public oEmbed endpoints. The pasted link is only ever sent as a parameter. */
const ENDPOINTS: Record<TitleLinkService, string> = {
  youtube: "https://www.youtube.com/oembed",
  soundcloud: "https://soundcloud.com/oembed",
};

export interface LinkTitle {
  title: string;
  author: string;
}

export interface LinkTitleDeps {
  fetchImpl?: typeof fetch;
}

/** Reads the title and uploader of a link. Returns `null` on any failure. */
export async function fetchLinkTitle(
  service: TitleLinkService,
  url: string,
  deps: LinkTitleDeps = {},
): Promise<LinkTitle | null> {
  const params = new URLSearchParams({ url, format: "json" });
  try {
    const response = await request(`${ENDPOINTS[service]}?${params}`, {
      headers: { Accept: "application/json" },
      retries: 0,
      timeoutMs: 4000,
      fetchImpl: deps.fetchImpl,
    });
    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }
    const body = await readJson<{ title?: unknown; author_name?: unknown }>(response);
    if (typeof body.title !== "string" || !body.title.trim()) return null;
    return {
      title: body.title.trim(),
      author: typeof body.author_name === "string" ? body.author_name.trim() : "",
    };
  } catch {
    return null;
  }
}

/** Bracketed video labels that are not part of a song's name. */
const VIDEO_NOISE =
  /[([][^)\]]*\b(official|video|audio|lyrics?|visuali[sz]er|hd|hq|4k|mv|teaser|trailer|full song|out now)\b[^)\]]*[)\]]/gi;

/**
 * Turns a video or upload title into a catalog search, e.g.
 * "Artist - Song (Official Music Video)" becomes "Artist - Song".
 */
export function linkTitleToQuery(service: TitleLinkService, link: LinkTitle): string {
  let title = link.title.replace(VIDEO_NOISE, " ");
  let author = link.author;

  if (service === "youtube") {
    title = title.split(" | ")[0];
    author = author.replace(/\s*-\s*Topic$/i, "").replace(/(VEVO|Official)$/i, "");
  } else {
    // SoundCloud titles read "Song by Artist".
    const by = title.lastIndexOf(" by ");
    if (by > 0) {
      author = title.slice(by + 4);
      title = title.slice(0, by);
    }
  }

  const hasArtist = /\s[-–—]\s/.test(title);
  return (hasArtist ? title : `${title} ${author}`).replace(/\s+/g, " ").trim().slice(0, 150);
}
