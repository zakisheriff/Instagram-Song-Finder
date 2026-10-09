import { TtlCache } from "@/lib/cache/ttl-cache";
import { isMusicError, MusicError } from "@/lib/music/errors";
import type {
  MusicProvider,
  ProviderId,
  ProviderInfo,
  SearchPage,
  Track,
} from "@/lib/music/types";
import { resolveSpotifyShortLink } from "@/lib/spotify/short-link";
import { detectInput, MIN_TEXT_QUERY_LENGTH } from "./detect";

export type ResolvedKind = "text" | "isrc" | "spotify-track";

export interface ResolveResult {
  kind: ResolvedKind;
  /** The normalized query that was actually looked up. */
  query: string;
  provider: ProviderInfo;
  tracks: Track[];
  nextOffset: number | null;
  total: number | null;
}

export interface ResolveOptions {
  providers: MusicProvider[];
  offset?: number;
  /** Pins pagination to the provider that served the first page. */
  provider?: ProviderId;
  resolveShortLink?: (url: string) => Promise<string>;
  cache?: TtlCache<unknown>;
}

const SEARCH_TTL_MS = 5 * 60_000;
const TRACK_TTL_MS = 10 * 60_000;
const SHORT_LINK_TTL_MS = 10 * 60_000;

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
        publicMessage: "Enter a song, artist, Spotify link or ISRC to search.",
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
      const { provider, value } = await firstSuccessful(
        candidates,
        (provider) =>
          cache.getOrLoad(
            `search:${provider.info.id}:${offset}:${detected.query.toLowerCase()}`,
            SEARCH_TTL_MS,
            () => provider.searchTracks(detected.query, { offset }),
          ) as Promise<SearchPage>,
        // Only the first page may fall through to another provider.
        (page) => offset === 0 && page.tracks.length === 0,
      );
      return { kind: "text", query: detected.query, provider: provider.info, ...value };
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
      if (!spotify?.isConfigured()) {
        throw new MusicError("NOT_CONFIGURED", "Spotify link lookup needs Spotify credentials", {
          publicMessage:
            "Spotify links can't be looked up right now. Search by song title and artist instead.",
        });
      }

      let trackId: string;
      if (detected.kind === "spotify-track") {
        trackId = detected.trackId;
      } else {
        const resolveShortLink = options.resolveShortLink ?? resolveSpotifyShortLink;
        trackId = (await cache.getOrLoad(`short:${detected.url}`, SHORT_LINK_TTL_MS, () =>
          resolveShortLink(detected.url),
        )) as string;
      }

      // `null` (track not found) is wrapped so that it can be cached as a value.
      const { track } = (await cache.getOrLoad(`track:spotify:${trackId}`, TRACK_TTL_MS, async () => ({
        track: await spotify.getTrack(trackId),
      }))) as { track: Track | null };

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
  }
}
