import { z } from "zod";

/** Treats blank values (a common .env leftover) the same as an unset variable. */
const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const PROVIDER_IDS = ["spotify", "deezer"] as const;

const providerList = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() !== ""
      ? value.split(",").map((part) => part.trim().toLowerCase())
      : undefined,
  z
    .array(z.enum(PROVIDER_IDS))
    .min(1)
    .refine((list) => new Set(list).size === list.length, "must not repeat a provider")
    .default(["spotify", "deezer"]),
);

const serverEnvSchema = z
  .object({
    SPOTIFY_CLIENT_ID: optionalString,
    SPOTIFY_CLIENT_SECRET: optionalString,
    /** Comma-separated provider order, e.g. `spotify,deezer` or just `spotify`. */
    MUSIC_PROVIDERS: providerList,
  })
  .superRefine((env, context) => {
    if (Boolean(env.SPOTIFY_CLIENT_ID) !== Boolean(env.SPOTIFY_CLIENT_SECRET)) {
      context.addIssue({
        code: "custom",
        path: [env.SPOTIFY_CLIENT_ID ? "SPOTIFY_CLIENT_SECRET" : "SPOTIFY_CLIENT_ID"],
        message: "SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set together",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Validates server-only configuration. Error text lists variable names only,
 * never their values.
 */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration. ${problems}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

/** Test hook. */
export function resetServerEnvCache(): void {
  cached = undefined;
}
