export type MusicErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "PROVIDER_AUTH"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "NOT_CONFIGURED"
  | "UNRESOLVABLE_LINK"
  | "INTERNAL";

const HTTP_STATUS: Record<MusicErrorCode, number> = {
  INVALID_INPUT: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  PROVIDER_AUTH: 502,
  PROVIDER_UNAVAILABLE: 502,
  PROVIDER_TIMEOUT: 504,
  NOT_CONFIGURED: 503,
  UNRESOLVABLE_LINK: 422,
  INTERNAL: 500,
};

/** Messages safe to show to visitors. They never include upstream response bodies. */
const PUBLIC_MESSAGES: Record<MusicErrorCode, string> = {
  INVALID_INPUT: "That search couldn't be understood. Check it and try again.",
  NOT_FOUND: "No matching recording was found.",
  RATE_LIMITED: "Too many searches right now. Wait a moment and try again.",
  PROVIDER_AUTH: "The music catalog rejected our request. Please try again later.",
  PROVIDER_UNAVAILABLE: "The music catalog is unavailable right now. Please try again shortly.",
  PROVIDER_TIMEOUT: "The music catalog took too long to respond. Please try again.",
  NOT_CONFIGURED: "Song search isn't available right now. Please try again later.",
  UNRESOLVABLE_LINK:
    "That share link couldn't be opened safely. Paste the full open.spotify.com track link instead.",
  INTERNAL: "Something went wrong. Please try again.",
};

/** Failures another provider might still be able to serve. */
const FALLBACK_CODES: ReadonlySet<MusicErrorCode> = new Set([
  "RATE_LIMITED",
  "PROVIDER_AUTH",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_TIMEOUT",
  "NOT_CONFIGURED",
]);

export interface MusicErrorOptions {
  /** Overrides the default visitor-facing message. */
  publicMessage?: string;
  retryAfterSeconds?: number;
  cause?: unknown;
}

export class MusicError extends Error {
  readonly code: MusicErrorCode;
  readonly publicMessage: string;
  readonly retryAfterSeconds?: number;

  constructor(code: MusicErrorCode, detail?: string, options: MusicErrorOptions = {}) {
    super(detail ?? PUBLIC_MESSAGES[code], { cause: options.cause });
    this.name = "MusicError";
    this.code = code;
    this.publicMessage = options.publicMessage ?? PUBLIC_MESSAGES[code];
    this.retryAfterSeconds = options.retryAfterSeconds;
  }

  get httpStatus(): number {
    return HTTP_STATUS[this.code];
  }

  /** True when trying the next configured provider is worthwhile. */
  get allowsFallback(): boolean {
    return FALLBACK_CODES.has(this.code);
  }
}

export function isMusicError(error: unknown): error is MusicError {
  return error instanceof MusicError;
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: unknown }).name === "AbortError"
  );
}
