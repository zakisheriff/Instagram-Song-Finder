import { z } from "zod";
import { isMusicError, MusicError } from "@/lib/music/errors";
import type { MusicProvider } from "@/lib/music/types";
import { clientKey, RateLimiter } from "@/lib/rate-limit";
import { detectInput, MAX_QUERY_LENGTH } from "@/lib/search/detect";
import { parseIsrc } from "@/lib/search/isrc";
import { resolveQuery, type ResolveOptions, type ResolveResult } from "@/lib/search/resolve";
import type { ApiFailure, SearchSuccess } from "./contract";

export interface HandlerDeps {
  getProviders: () => MusicProvider[];
  limiter: RateLimiter;
  resolveShortLink?: ResolveOptions["resolveShortLink"];
  cache?: ResolveOptions["cache"];
  logger?: Pick<Console, "error">;
}

/** Successful lookups are safe to share: they depend only on the query string. */
const SUCCESS_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";

const BASE_HEADERS = {
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
} as const;

const searchSchema = z.object({
  q: z.string().min(1).max(MAX_QUERY_LENGTH * 4),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
  provider: z.enum(["spotify", "deezer"]).optional(),
});

const trackSchema = z
  .object({
    url: z.string().min(1).max(MAX_QUERY_LENGTH * 4).optional(),
    isrc: z.string().min(1).max(40).optional(),
  })
  .refine((value) => Boolean(value.url) !== Boolean(value.isrc), {
    message: "Provide exactly one of `url` or `isrc`.",
  });

function success(result: ResolveResult): Response {
  const body: SearchSuccess = { ok: true, ...result };
  return Response.json(body, {
    status: 200,
    headers: { ...BASE_HEADERS, "Cache-Control": SUCCESS_CACHE_CONTROL },
  });
}

function failure(error: MusicError): Response {
  const body: ApiFailure = {
    ok: false,
    error: {
      code: error.code,
      message: error.publicMessage,
      ...(error.retryAfterSeconds !== undefined && {
        retryAfterSeconds: error.retryAfterSeconds,
      }),
    },
  };
  const headers: Record<string, string> = { ...BASE_HEADERS, "Cache-Control": "no-store" };
  if (error.code === "RATE_LIMITED") {
    headers["Retry-After"] = String(error.retryAfterSeconds ?? 30);
  }
  return Response.json(body, { status: error.httpStatus, headers });
}

function toMusicError(error: unknown, logger: Pick<Console, "error">): MusicError {
  if (isMusicError(error)) {
    // Expected visitor mistakes are not worth logging; upstream trouble is.
    if (error.httpStatus >= 500) logger.error(`[music] ${error.code}: ${error.message}`);
    return error;
  }
  logger.error("[music] unexpected error", error);
  return new MusicError("INTERNAL");
}

function checkRateLimit(request: Request, deps: HandlerDeps): MusicError | null {
  const result = deps.limiter.check(clientKey(request.headers));
  return result.allowed
    ? null
    : new MusicError("RATE_LIMITED", "Client rate limit exceeded", {
        publicMessage: "You're searching very quickly. Wait a few seconds and try again.",
        retryAfterSeconds: result.retryAfterSeconds,
      });
}

async function run(
  request: Request,
  deps: HandlerDeps,
  work: (params: URLSearchParams) => Promise<ResolveResult>,
): Promise<Response> {
  const logger = deps.logger ?? console;
  try {
    const limited = checkRateLimit(request, deps);
    if (limited) return failure(limited);
    return success(await work(new URL(request.url).searchParams));
  } catch (error) {
    return failure(toMusicError(error, logger));
  }
}

function invalid(message: string): MusicError {
  return new MusicError("INVALID_INPUT", message, { publicMessage: message });
}

/** `GET /api/search?q=…&offset=…&provider=…`: the universal search endpoint. */
export function handleSearch(request: Request, deps: HandlerDeps): Promise<Response> {
  return run(request, deps, async (params) => {
    const parsed = searchSchema.safeParse(Object.fromEntries(params));
    if (!parsed.success) {
      throw invalid("Enter a song, artist, Spotify link or ISRC to search.");
    }
    return resolveQuery(parsed.data.q, {
      providers: deps.getProviders(),
      offset: parsed.data.offset,
      provider: parsed.data.provider,
      resolveShortLink: deps.resolveShortLink,
      cache: deps.cache,
    });
  });
}

/**
 * `GET /api/track?url=…` looks up one exact recording from a Spotify track
 * link, share link or URI. `GET /api/track?isrc=…` looks up recordings by ISRC.
 */
export function handleTrack(request: Request, deps: HandlerDeps): Promise<Response> {
  return run(request, deps, async (params) => {
    const parsed = trackSchema.safeParse(Object.fromEntries(params));
    if (!parsed.success) {
      throw invalid("Provide a Spotify track link in `url` or an ISRC in `isrc`.");
    }

    let query: string;
    if (parsed.data.isrc) {
      const isrc = parseIsrc(parsed.data.isrc.replace(/^isrc:/i, ""));
      if (!isrc) {
        throw invalid("That doesn't look like a valid ISRC. An ISRC has 12 characters.");
      }
      query = `isrc:${isrc}`;
    } else {
      query = parsed.data.url!;
      const detected = detectInput(query);
      if (detected.kind === "invalid") throw invalid(detected.message);
      if (detected.kind !== "spotify-track" && detected.kind !== "spotify-short-link") {
        throw invalid("`url` must be a Spotify track link, share link or spotify:track: URI.");
      }
    }

    return resolveQuery(query, {
      providers: deps.getProviders(),
      resolveShortLink: deps.resolveShortLink,
      cache: deps.cache,
    });
  });
}
