import { TtlCache } from "@/lib/cache/ttl-cache";
import { isMusicError, MusicError } from "@/lib/music/errors";
import type {
  MusicProvider,
  ProviderId,
  ProviderInfo,
  SearchPage,
  Track,
} from "@/lib/music/types";
import { lookupAppleTrack as defaultLookupAppleTrack, type AppleTrack } from "@/lib/apple/lookup";
import {
  fetchLinkTitle as defaultFetchLinkTitle,
  linkTitleToQuery,
  TITLE_LINK_SERVICE_NAMES,
  type LinkTitle,
  type TitleLinkService,
} from "@/lib/links/title";
import { fetchSpotifyTitle as defaultFetchSpotifyTitle } from "@/lib/spotify/oembed";
import { resolveSpotifyShortLink } from "@/lib/spotify/short-link";
import { detectInput, MIN_TEXT_QUERY_LENGTH } from "./detect";
import { pageSimilarity, relaxedQueries, trackSimilarity } from "./similarity";

export type ResolvedKind = "text" | "isrc" | "spotify-track" | "link-match";

export interface ResolveResult {
  kind: ResolvedKind;
  /** The normalized query that was actually looked up. */
  query: string;
  provider: ProviderInfo;
  tracks: Track[];
  nextOffset: number | null;
  total: number | null;
  /** True when nothing matched the query as typed and a looser search was used. */
  approximate?: boolean;
  /** Short explanation shown above the results when they need one. */
  notice?: string;
}

export interface ResolveOptions {
  providers: MusicProvider[];
  offset?: number;
  /** Pins pagination to the provider that served the first page. */
  provider?: ProviderId;
  resolveShortLink?: (url: string) => Promise<string>;
  lookupAppleTrack?: (trackId: string, country: string) => Promise<AppleTrack | null>;
  fetchSpotifyTitle?: (trackId: string) => Promise<string | null>;
  fetchLinkTitle?: (service: TitleLinkService, url: string) => Promise<LinkTitle | null>;
  cache?: TtlCache<unknown>;
}

const SEARCH_TTL_MS = 5 * 60_000;
const TRACK_TTL_MS = 10 * 60_000;
const SHORT_LINK_TTL_MS = 10 * 60_000;

/** A page whose best result matches the query this well needs no second opinion. */
const CONFIDENT_MATCH = 0.9;
/** Another catalog must beat the preferred one by this much to replace it. */
const SWITCH_MARGIN = 0.05;
/** Two recordings this close in length are treated as the same one. */
const LENGTH_TOLERANCE_MS = 3000;

const sharedCache = new TtlCache<unknown>({ maxEntries: 1000 });

/**
 * Runs `attempt` against each provider in order until one succeeds. A provider
 * is skipped when it is unconfigured, rate limited or down; any other failure
 * stops the chain. `isEmpty` lets a later provider try when an earlier one
 * simply had nothing.
 */
async function firstSuccessful<T>(
  providers: MusicProvider[],
  attempt: (provider: MusicProvider) => Promise<T>,
  isEmpty: (value: T) => boolean,
): Promise<{ provider: MusicProvider; value: T }> {
  let emptyResult: { provider: MusicProvider; value: T } | undefined;
  let failure: MusicError | undefined;

  for (const provider of providers) {
    if (!provider.isConfigured()) continue;
    try {
      const value = await attempt(provider);
      if (!isEmpty(value)) return { provider, value };
      emptyResult ??= { provider, value };
    } catch (error) {
      if (!isMusicError(error) || !error.allowsFallback) throw error;
      failure ??= error;
    }
  }

  if (emptyResult) return emptyResult;
  throw failure ?? new MusicError("NOT_CONFIGURED", "No music provider is configured");
}

/**
 * Resolves anything typed into the universal search box (song, artist,
 * keywords, Spotify link, Spotify URI or ISRC) to real catalog metadata.
 * Throws a `MusicError` with a visitor-safe message when it cannot.
 */
export async function resolveQuery(raw: string, options: ResolveOptions): Promise<ResolveResult> {
  const cache = options.cache ?? sharedCache;
  const offset = options.offset ?? 0;
  const candidates = options.provider
    ? options.providers.filter((provider) => provider.info.id === options.provider)
    : options.providers;

  const detected = detectInput(raw);

  switch (detected.kind) {
    case "empty":
      throw new MusicError("INVALID_INPUT", "Empty query", {
        publicMessage: "Enter a song, artist, music link or ISRC to search.",
      });

    case "invalid":
      throw new MusicError("INVALID_INPUT", `Invalid input: ${detected.reason}`, {
        publicMessage: detected.message,
      });

    case "text": {
      if (detected.query.length < MIN_TEXT_QUERY_LENGTH) {
        throw new MusicError("INVALID_INPUT", "Query too short", {
          publicMessage: `Type at least ${MIN_TEXT_QUERY_LENGTH} characters to search.`,
        });
      }
      const search = (provider: MusicProvider, query: string) =>
        cache.getOrLoad(`search:${provider.info.id}:${offset}:${query.toLowerCase()}`, SEARCH_TTL_MS, () =>
          provider.searchTracks(query, { offset }),
        ) as Promise<SearchPage>;

      // Later pages stay with the provider that served the first one.
      if (offset > 0 || options.provider) {
        const { provider, value } = await firstSuccessful(
          candidates,
          (provider) => search(provider, detected.query),
          () => false,
        );
        return { kind: "text", query: detected.query, provider: provider.info, ...value };
      }

      const available = candidates.filter((provider) => provider.isConfigured());
      let best: { provider: MusicProvider; page: SearchPage; score: number } | undefined;
      let empty: { provider: MusicProvider; page: SearchPage } | undefined;
      let failure: MusicError | undefined;

      // Typo tolerance: when the preferred catalog's results don't really match
      // what was typed, ask the next one and keep whichever matches better.
      for (const provider of available) {
        let page: SearchPage;
        try {
          page = await search(provider, detected.query);
        } catch (error) {
          if (!isMusicError(error) || !error.allowsFallback) throw error;
          failure ??= error;
          continue;
        }
        if (page.tracks.length === 0) {
          empty ??= { provider, page };
          continue;
        }
        const score = pageSimilarity(detected.query, page.tracks);
        if (!best || score > best.score + SWITCH_MARGIN) best = { provider, page, score };
        if (best.score >= CONFIDENT_MATCH) break;
      }

      if (best) {
        return { kind: "text", query: detected.query, provider: best.provider.info, ...best.page };
      }

      // Nothing anywhere: retry with one word left out at a time.
      for (const variant of relaxedQueries(detected.query)) {
        for (const provider of available) {
          try {
            const page = await search(provider, variant);
            if (page.tracks.length > 0) {
              return {
                kind: "text",
                query: variant,
                provider: provider.info,
                approximate: true,
                ...page,
              };
            }
          } catch (error) {
            if (!isMusicError(error) || !error.allowsFallback) throw error;
            failure ??= error;
          }
        }
      }

      if (empty) {
        return { kind: "text", query: detected.query, provider: empty.provider.info, ...empty.page };
      }
      throw failure ?? new MusicError("NOT_CONFIGURED", "No music provider is configured");
    }

    case "isrc": {
      const { provider, value } = await firstSuccessful(
        candidates,
        (provider) =>
          cache.getOrLoad(`isrc:${provider.info.id}:${detected.isrc}`, TRACK_TTL_MS, () =>
            provider.findByIsrc(detected.isrc),
          ) as Promise<Track[]>,
        (tracks) => tracks.length === 0,
      );
      if (value.length === 0) {
        throw new MusicError("NOT_FOUND", `No recording for ISRC ${detected.isrc}`, {
          publicMessage: `No recording with the ISRC ${detected.isrc} was found. The code may be correct but missing from the catalog we search.`,
        });
      }
      return {
        kind: "isrc",
        query: detected.isrc,
        provider: provider.info,
        tracks: value,
        nextOffset: null,
        total: value.length,
      };
    }

    case "spotify-track":
    case "spotify-short-link": {
      const spotify = options.providers.find((provider) => provider.info.id === "spotify");
      const unavailable = new MusicError("NOT_CONFIGURED", "Spotify link lookup needs Spotify credentials", {
        publicMessage:
          "Spotify links can't be looked up right now. Search by song title and artist instead.",
      });

      let trackId: string;
      if (detected.kind === "spotify-track") {
        trackId = detected.trackId;
      } else {
        const resolveShortLink = options.resolveShortLink ?? resolveSpotifyShortLink;
        trackId = (await cache.getOrLoad(`short:${detected.url}`, SHORT_LINK_TTL_MS, () =>
          resolveShortLink(detected.url),
        )) as string;
      }

      /**
       * When Spotify's catalog can't be asked, its public oEmbed endpoint still
       * gives the track's title. That is enough for a title search, presented
       * honestly as possible matches rather than as the exact track.
       */
      const searchByTitle = async (cause: MusicError): Promise<ResolveResult> => {
        const fetchTitle = options.fetchSpotifyTitle ?? defaultFetchSpotifyTitle;
        const title = (await cache.getOrLoad(`oembed:${trackId}`, TRACK_TTL_MS, async () => ({
          title: await fetchTitle(trackId),
        }))) as { title: string | null };
        if (!title.title) throw cause;
        try {
          const found = await resolveQuery(title.title, {
            ...options,
            offset: 0,
            provider: undefined,
            providers: options.providers.filter((provider) => provider.info.id !== "spotify"),
          });
          if (found.tracks.length === 0) throw cause;
          return {
            ...found,
            notice: `Spotify couldn't confirm this exact track. Showing matches for "${title.title}"`,
          };
        } catch {
          throw cause;
        }
      };

      if (!spotify?.isConfigured()) return searchByTitle(unavailable);

      // `null` (track not found) is wrapped so that it can be cached as a value.
      let track: Track | null;
      try {
        ({ track } = (await cache.getOrLoad(`track:spotify:${trackId}`, TRACK_TTL_MS, async () => ({
          track: await spotify.getTrack(trackId),
        }))) as { track: Track | null });
      } catch (error) {
        if (isMusicError(error) && error.allowsFallback) {
          return searchByTitle(
            new MusicError(error.code, error.message, {
              publicMessage: unavailable.publicMessage,
              retryAfterSeconds: error.retryAfterSeconds,
              cause: error,
            }),
          );
        }
        throw error;
      }

      if (!track) {
        throw new MusicError("NOT_FOUND", `Spotify track ${trackId} not found`, {
          publicMessage:
            "That Spotify track couldn't be found. It may have been removed or the link may be incomplete.",
        });
      }
      return {
        kind: "spotify-track",
        query: trackId,
        provider: spotify.info,
        tracks: [track],
        nextOffset: null,
        total: 1,
      };
    }
    case "deezer-track": {
      const deezer = options.providers.find((provider) => provider.info.id === "deezer");
      if (!deezer?.isConfigured()) {
        throw new MusicError("NOT_CONFIGURED", "Deezer links need the Deezer catalog", {
          publicMessage: "Deezer links can't be looked up right now. Search by song title and artist instead.",
        });
      }
      const { track } = (await cache.getOrLoad(`track:deezer:${detected.trackId}`, TRACK_TTL_MS, async () => ({
        track: await deezer.getTrack(detected.trackId),
      }))) as { track: Track | null };
      if (!track) {
        throw new MusicError("NOT_FOUND", `Deezer track ${detected.trackId} not found`, {
          publicMessage: "That Deezer track couldn't be found. It may have been removed or the link may be incomplete.",
        });
      }
      return {
        kind: "link-match",
        query: detected.trackId,
        provider: deezer.info,
        tracks: [track],
        nextOffset: null,
        total: 1,
        notice: "Exact match for your Deezer link",
      };
    }

    case "title-link": {
      // These services expose a title but no recording code, so the link
      // becomes a catalog search and the visitor confirms the recording.
      const serviceName = TITLE_LINK_SERVICE_NAMES[detected.service];
      const fetchTitle = options.fetchLinkTitle ?? defaultFetchLinkTitle;
      const { link } = (await cache.getOrLoad(`link:${detected.url}`, TRACK_TTL_MS, async () => ({
        link: await fetchTitle(detected.service, detected.url),
      }))) as { link: LinkTitle | null };
      const query = link ? linkTitleToQuery(detected.service, link) : "";
      if (query.length < MIN_TEXT_QUERY_LENGTH) {
        throw new MusicError("NOT_FOUND", `Could not read ${detected.service} link`, {
          publicMessage: `That ${serviceName} link couldn't be read. Check it, or search by song title and artist.`,
        });
      }
      const found = await resolveQuery(query, { ...options, offset: 0, provider: undefined });
      if (found.tracks.length === 0) {
        throw new MusicError("NOT_FOUND", `No catalog match for ${detected.service} link`, {
          publicMessage: `No recording matching "${query}" was found. Try searching by song title and artist.`,
        });
      }
      return {
        ...found,
        kind: "link-match",
        notice: `From your ${serviceName} link. Select the correct recording`,
      };
    }

    case "apple-music-track": {
      const lookup = options.lookupAppleTrack ?? defaultLookupAppleTrack;
      const { song } = (await cache.getOrLoad(
        `apple:${detected.country}:${detected.trackId}`,
        TRACK_TTL_MS,
        async () => ({ song: await lookup(detected.trackId, detected.country) }),
      )) as { song: AppleTrack | null };

      if (!song) {
        throw new MusicError("NOT_FOUND", `Apple Music song ${detected.trackId} not found`, {
          publicMessage:
            "That Apple Music song couldn't be found. Check the link, or search by song title and artist.",
        });
      }

      // Apple's lookup has no ISRC, so the recording is found in a catalog that
      // does by title and artist, then confirmed by title and length.
      const primaryArtist = song.artist.split(/,|&| feat\.? /i)[0]?.trim() ?? "";
      const query = [song.title, primaryArtist].filter(Boolean).join(" ");
      const available = candidates.filter((provider) => provider.isConfigured());
      let closest: { provider: MusicProvider; page: SearchPage } | undefined;
      let failure: MusicError | undefined;

      for (const provider of available) {
        let page: SearchPage;
        try {
          page = (await cache.getOrLoad(
            `search:${provider.info.id}:0:${query.toLowerCase()}`,
            SEARCH_TTL_MS,
            () => provider.searchTracks(query, { offset: 0 }),
          )) as SearchPage;
        } catch (error) {
          if (!isMusicError(error) || !error.allowsFallback) throw error;
          failure ??= error;
          continue;
        }
        if (page.tracks.length === 0) continue;
        closest ??= { provider, page };

        const matches = page.tracks.filter((track) => {
          const sameLength =
            song.durationMs === null ||
            track.durationMs === null ||
            Math.abs(track.durationMs - song.durationMs) <= LENGTH_TOLERANCE_MS;
          const titleOnly = { ...track, artists: [], album: null };
          return sameLength && trackSimilarity(song.title, titleOnly) >= CONFIDENT_MATCH;
        });
        if (matches.length > 0) {
          return {
            kind: "link-match",
            query,
            provider: provider.info,
            tracks: matches,
            nextOffset: null,
            total: matches.length,
            notice: "Matched to your Apple Music link by title, artist and length",
          };
        }
      }

      if (closest) {
        return {
          kind: "link-match",
          query,
          provider: closest.provider.info,
          ...closest.page,
          nextOffset: null,
          approximate: true,
          notice: `No exact match for your Apple Music link. Showing the closest results for "${song.title}"`,
        };
      }
      throw (
        failure ??
        new MusicError("NOT_FOUND", `No catalog match for Apple Music song ${detected.trackId}`, {
          publicMessage: `"${song.title}" couldn't be found in the catalog we search.`,
        })
      );
    }
  }
}
