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
  /[([][^)\]]*\b(official|video|audio|lyrics?|lyrical|visuali[sz]er|hd|hq|4k|mv|teaser|trailer|full song|out now)\b[^)\]]*[)\]]/gi;

/** Brackets worth keeping, because they name a different recording of the song. */
const VERSION_WORDS =
  /\b(remix(ed)?|mix|live|acoustic|unplugged|stripped|slowed|sped|nightcore|instrumental|karaoke|version|edit|extended|remaster(ed)?|demo|cover|reprise)\b/i;

/** The same video labels written without brackets, at the end of a title. */
const TRAILING_NOISE =
  /\s+(official|lyrics?|lyrical|video|audio|visuali[sz]er|music video|(video|lyrical|full|audio|title) song|hd|4k)$/i;

export interface LinkSearch {
  /** The song as the link names it. */
  song: string;
  /** Ways the song may be written; a result matching any of them is the same song. */
  names: string[];
  /** Catalog searches to try in order, most specific first. */
  queries: string[];
  /** Names that may be the artist: the uploader and any credits in the title. */
  credits: string[];
}

const tidy = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 150);

/**
 * Turns a video or upload title into catalog searches, e.g.
 * "Artist - Song (Official Music Video)" becomes "Artist - Song", and
 * `Song (feat. Guest) [From "Film"]` on an artist's channel becomes "Song Artist".
 */
export function linkTitleToSearch(service: TitleLinkService, link: LinkTitle): LinkSearch {
  let title = link.title.replace(VIDEO_NOISE, " ");
  let author = link.author;
  let extras: string[] = [];

  if (service === "youtube") {
    // Label uploads read "Song Lyric | Film | Cast | Composer".
    [title, ...extras] = title.split(/\s[|｜]\s/);
    author = author.replace(/\s*-\s*Topic$/i, "").replace(/(VEVO|Official)$/i, "");
  } else {
    // SoundCloud titles read "Song by Artist".
    const by = title.lastIndexOf(" by ");
    if (by > 0) {
      author = title.slice(by + 4);
      title = title.slice(0, by);
    }
  }

  // Credits and film names in brackets differ between services; versions don't.
  title = title.replace(/[([][^)\]]*[)\]]/g, (part) => (VERSION_WORDS.test(part) ? part : " "));
  // Guest credits written without brackets: "Artist - Song ft. Guest".
  title = tidy(title.replace(/\s(ft|feat|featuring)\.?\s.*$/i, " "));
  while (TRAILING_NOISE.test(title)) title = title.replace(TRAILING_NOISE, "");

  const dash = title.match(/\s[-–—]\s/);
  const queries = dash
    ? [title, title.slice(dash.index! + dash[0].length), title.slice(0, dash.index)]
    : [`${title} ${author}`, title];

  // Catalogs often list only the main artist, so "Artist - Song" also matches on the song alone.
  const names = dash ? [title, title.slice(dash.index! + dash[0].length)] : [title];

  return {
    song: title,
    names: names.map(tidy).filter(Boolean),
    queries: [...new Set(queries.map(tidy))].filter(Boolean),
    credits: [...new Set([dash ? title.slice(0, dash.index) : "", author, ...extras].map(tidy))].filter(Boolean),
  };
}
