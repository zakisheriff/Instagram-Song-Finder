import type { NextConfig } from "next";
import { parseServerEnv } from "./lib/env";

// Fail the build early on a broken configuration (for example only one of the
// two Spotify credentials) instead of discovering it on the first request.
parseServerEnv(process.env);

const isProduction = process.env.NODE_ENV === "production";

/** Album artwork is the only third-party content the pages load. */
const ARTWORK_HOSTS = ["https://i.scdn.co", "https://*.dzcdn.net"];

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js injects small inline bootstrap scripts; no third-party script origins are allowed.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${ARTWORK_HOSTS.join(" ")}`,
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=(), clipboard-write=(self)",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // The policy is production-only because the dev server relies on eval for hot reloading.
  ...(isProduction ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }] : []),
];

// Pin the workspace root to this project so a stray lockfile higher up the
// directory tree is never mistaken for it.
const projectRoot = process.cwd();

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  turbopack: { root: projectRoot },
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.scdn.co", pathname: "/image/**" },
      { protocol: "https", hostname: "**.dzcdn.net", pathname: "/images/**" },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
