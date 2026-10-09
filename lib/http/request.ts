import { isAbortError, MusicError } from "@/lib/music/errors";

export interface RequestOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: BodyInit;
  /** Abort signal from the caller, e.g. when the visitor's request is cancelled. */
  signal?: AbortSignal;
  /** Per-attempt timeout. */
  timeoutMs?: number;
  /** Extra attempts after the first, for network errors and 5xx responses only. */
  retries?: number;
  redirect?: RequestRedirect;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests so backoff doesn't slow them down. */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_RETRIES = 2;
const BACKOFF_BASE_MS = 200;
/** Longest upstream Retry-After we are willing to wait out inside one request. */
const MAX_INLINE_RETRY_AFTER_SECONDS = 1;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Parses a Retry-After header given in seconds. HTTP-date values are ignored. */
export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : undefined;
}

/**
 * `fetch` with a timeout, caller cancellation and bounded retries with
 * exponential backoff. Resolves with the response for any status below 500
 * other than 429; callers decide what 4xx responses mean.
 */
export async function request(url: string, options: RequestOptions = {}): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    fetchImpl = fetch,
    sleep = defaultSleep,
    signal,
    ...init
  } = options;

  let lastError: MusicError | undefined;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
    if (attempt > 0) await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));

    const timeout = AbortSignal.timeout(timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

    try {
      const response = await fetchImpl(url, { ...init, signal: combined, cache: "no-store" });

      if (response.status === 429) {
        const retryAfterSeconds = parseRetryAfter(response.headers.get("retry-after"));
        const canWait =
          attempt < retries &&
          retryAfterSeconds !== undefined &&
          retryAfterSeconds <= MAX_INLINE_RETRY_AFTER_SECONDS;
        if (!canWait) {
          throw new MusicError("RATE_LIMITED", `Upstream rate limit (${new URL(url).host})`, {
            retryAfterSeconds,
          });
        }
        await response.body?.cancel();
        await sleep(retryAfterSeconds * 1000);
        continue;
      }

      if (response.status >= 500) {
        await response.body?.cancel();
        lastError = new MusicError(
          "PROVIDER_UNAVAILABLE",
          `Upstream ${response.status} (${new URL(url).host})`,
        );
        continue;
      }

      return response;
    } catch (error) {
      if (error instanceof MusicError) throw error;
      // The visitor went away: stop immediately and let the caller see the abort.
      if (signal?.aborted) throw error;
      if (timeout.aborted || isAbortError(error)) {
        lastError = new MusicError("PROVIDER_TIMEOUT", `Upstream timeout (${new URL(url).host})`, {
          cause: error,
        });
        continue;
      }
      lastError = new MusicError(
        "PROVIDER_UNAVAILABLE",
        `Network error (${new URL(url).host})`,
        { cause: error },
      );
    }
  }

  throw lastError ?? new MusicError("PROVIDER_UNAVAILABLE");
}

/** Reads a JSON body, turning malformed payloads into a provider error. */
export async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new MusicError("PROVIDER_UNAVAILABLE", "Upstream returned malformed JSON", {
      cause: error,
    });
  }
}
