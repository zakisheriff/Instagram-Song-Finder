import { getProviders } from "@/lib/music/registry";
import { RateLimiter } from "@/lib/rate-limit";
import type { HandlerDeps } from "./handlers";

/** Per-visitor budget shared by all lookup endpoints. */
const limiter = new RateLimiter({ limit: 60, windowMs: 60_000 });

export const productionDeps: HandlerDeps = { getProviders, limiter };
