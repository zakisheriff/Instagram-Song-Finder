# Instagram Song Finder

A free web tool by [The Atom](https://www.theatom.lk) that finds the ISRC of a song and formats it for Instagram's music search, for example `isrc:USUM72409273`.

Production domain: **https://instagramsongfinder.theatom.lk**

> Instagram Song Finder is an independent tool. It is not affiliated with, endorsed by or sponsored by Instagram, Meta or Spotify.

## What it does

One search box accepts all of the following and works out which one it was given:

| Input | Example |
| --- | --- |
| Song title, artist, both, partial title or keywords | `Die With A Smile Lady Gaga` |
| Spotify track link, with or without tracking parameters | `https://open.spotify.com/track/2plbrEY59IikOBgBGLjaoe?si=…` |
| Spotify share link | `https://spotify.link/…` |
| Spotify URI | `spotify:track:2plbrEY59IikOBgBGLjaoe` |
| ISRC, raw, hyphenated or prefixed | `USUM72409273`, `US-UM7-24-09273`, `isrc:USUM72409273` |

Each matching recording is listed separately with its artwork, artists, album, release date, length, version labels (Live, Remastered, Sped up, …) and its own ISRC. **Copy for Instagram** copies the full `isrc:CODE` string, and **Copy and open Instagram** copies it and opens Instagram (Instagram offers no link that pre-fills its music search, so pasting is still manual). When a catalog has no ISRC for a recording the site says so and never invents one.

## Stack

- Next.js 16 (App Router, React Server Components, Cache Components), React 19, TypeScript in strict mode
- Plain CSS with design tokens taken from the reference capture
- Zod for input and environment validation
- Vitest and Testing Library for unit and component tests, Playwright for end-to-end tests

## Getting started

Requires Node.js 22.12 or newer.

```bash
npm install
cp .env.example .env.local   # then fill in the Spotify credentials
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `SPOTIFY_CLIENT_ID` | For Spotify data | Client ID of your Spotify app |
| `SPOTIFY_CLIENT_SECRET` | For Spotify data | Client secret of your Spotify app. Server-side only |
| `MUSIC_PROVIDERS` | No | Comma-separated catalog order. Default `spotify,deezer`. Set to `spotify` to disable the fallback |

The two Spotify variables must be set together; the build fails if only one is present. Neither is ever sent to the browser. `.env*` files are git-ignored, apart from `.env.example`.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm run start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run test` | Unit and component tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright; builds the app first) |
| `npm run test:all` | Lint, typecheck, unit tests and end-to-end tests |
| `npm run icons` | Regenerates the favicon, app icons and logo files from `assets/brand/logo.webp` |

Before the first end-to-end run, install the browsers once: `npx playwright install chromium webkit`.

## Music data

### Spotify (primary)

The site uses the official [Spotify Web API](https://developer.spotify.com/documentation/web-api) with the Client Credentials flow: the server exchanges the client ID and secret for an app token, keeps it in memory, and requests a new one shortly before it expires or if Spotify answers `401`.

| Need | Endpoint |
| --- | --- |
| Text search | `GET /v1/search?type=track&q=…` |
| ISRC lookup | `GET /v1/search?type=track&q=isrc:CODE` |
| Exact track from a link or URI | `GET /v1/tracks/{id}` |

The ISRC is read from `external_ids.isrc`.

Things to know about Spotify's current rules (checked October 2026):

- **Premium is required.** A Development Mode app only works while its owner has an active Spotify Premium subscription.
- **Quota is small and shared.** Development Mode quota is counted per developer account. Extended quota is available to qualifying organisations only. A public site can therefore hit `429` responses under real traffic.
- **Search pages are capped at 10 results.** The interface pages through results with "Show more results".
- No `market` parameter is sent, on purpose: with a market Spotify may relink a track to a regional alternative, which can be a different recording with a different ISRC.

To set it up, create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), select the Web API, and copy the client ID and secret into the environment variables above. No redirect URI or user login is needed.

### Deezer (fallback)

[Deezer's public API](https://developers.deezer.com/api) needs no credentials and also returns ISRCs. It answers text and ISRC searches when Spotify is not configured, is rate limited or is down, so the site keeps working. Limits of the fallback:

- Spotify links, share links and URIs can only be resolved through Spotify. Without Spotify credentials those inputs return a clear "can't be looked up right now" message rather than a guessed match.
- Deezer's search results list only the primary artist.

A response always comes from a single catalog and the interface labels it ("Data from Spotify" or "Data from Deezer"). Results from different catalogs are never blended.

### Adding another provider

Implement the `MusicProvider` interface in `lib/music/types.ts`, add its id to `ProviderId` and to the schema in `lib/env.ts`, and register it in `lib/music/registry.ts`. Nothing else in the app depends on a specific catalog.

### Third-party terms to review before launch

- **Spotify Developer Terms and Design Guidelines.** Metadata and artwork are shown unmodified, link back to Spotify and are attributed in text. Spotify's guidelines also ask for the Spotify logo next to its content. The logo is not bundled here, because third-party logos were deliberately not recreated; download the official asset from Spotify's brand resources and place it beside the "Data from Spotify" label if you rely on Spotify data.
- **Deezer API terms**, if you keep the fallback enabled.
- **Caching.** Catalog responses are cached for a few minutes only (in memory and at the CDN) to absorb bursts. Nothing is stored long term.

## API

Both routes are `GET`, return JSON, are rate limited per client (60 requests a minute per server instance) and are excluded from indexing.

`/api/search?q=<anything>&offset=<n>&provider=<spotify|deezer>` is the universal endpoint used by the page.

`/api/track?url=<spotify link, share link or URI>` or `/api/track?isrc=<code>` looks up exact recordings.

Success:

```json
{
  "ok": true,
  "kind": "text",
  "query": "die with a smile",
  "provider": { "id": "spotify", "name": "Spotify" },
  "tracks": [{ "id": "spotify:…", "title": "…", "artists": ["…"], "isrc": "USUM72409273" }],
  "nextOffset": 10,
  "total": 120
}
```

Failure:

```json
{ "ok": false, "error": { "code": "RATE_LIMITED", "message": "…", "retryAfterSeconds": 20 } }
```

| Code | HTTP | Meaning |
| --- | --- | --- |
| `INVALID_INPUT` | 400 | Empty, too long, malformed ISRC, non-track or non-Spotify link |
| `NOT_FOUND` | 404 | No recording for that ISRC or track id |
| `UNRESOLVABLE_LINK` | 422 | A share link that could not be followed safely |
| `RATE_LIMITED` | 429 | Client or catalog rate limit; includes `Retry-After` |
| `PROVIDER_AUTH`, `PROVIDER_UNAVAILABLE` | 502 | The catalog rejected or failed the request |
| `NOT_CONFIGURED` | 503 | No catalog can answer, for example a Spotify link without credentials |
| `PROVIDER_TIMEOUT` | 504 | The catalog did not answer in time |

## Project structure

```
app/                 Pages, API routes, sitemap, robots, manifest, icons, social image
components/          UI: hero, search panel, results, content sections, footer
hooks/               useSongSearch (debounce, cancellation, paging) and useCopy
lib/search/          Input detection, ISRC helpers, query resolution
lib/spotify/         Authentication, catalog client, share-link resolver
lib/deezer/          Fallback catalog client
lib/music/           Provider contracts, errors, registry, formatting
lib/api/             Route handlers, response contract
lib/seo/             Metadata and structured data builders
lib/content/         FAQ and how-to copy
tests/unit/          Vitest suites
tests/e2e/           Playwright suites
```

## Security

- Credentials are read only on the server and validated at build time and start-up.
- Every query is validated with a shared detector and Zod before any upstream call.
- Outbound requests go only to `accounts.spotify.com`, `api.spotify.com`, `api.deezer.com` and, for share links, `spotify.link`, `spotify.app.link` and `open.spotify.com`. Share-link redirects are followed manually, one hop at a time, over HTTPS, and only to those hosts, so a redirect cannot reach an internal address.
- Upstream calls have timeouts, bounded retries with backoff and in-flight deduplication.
- Responses carry a Content Security Policy, HSTS, `X-Frame-Options: DENY` and related headers.
- No accounts, no tracking cookies, no analytics.

The built-in rate limiter keeps its counters in server memory, so on serverless hosting each instance counts separately. It stops bursts and loops. For a hard global limit, add your host's edge rate limiting (for example Vercel Firewall) or back `RateLimiter` with a shared store.

## SEO, AEO and GEO

- Next.js Metadata API: titles, descriptions, canonical URLs, Open Graph and Twitter cards, robots directives, icons and a generated social image
- `/sitemap.xml`, `/robots.txt` (API routes disallowed) and `/manifest.webmanifest`
- JSON-LD graph with `Organization`, `WebSite`, `WebApplication` and `WebPage`, plus `BreadcrumbList` on sub-pages. No ratings, reviews or usage figures
- A seven-step guide and ten direct-answer questions rendered on the server, in the page HTML
- `/llms.txt` as a supplementary summary for AI crawlers

`FAQPage` markup is intentionally absent: Google limits FAQ rich results to authoritative government and health sites, so adding it here would not be appropriate.

## Design reference

The interface reproduces the layout, spacing, colours, type scale and component shapes recorded in the supplied reference capture (`styles/layout.json` for desktop, `styles/layout.mobile.json` for phones): the two-column hero and form panel, 60px fields with a 16px radius and floating label, 44px pill buttons in three styles, the footer link row, and on phones the centred landing with the bottom tab bar.

The app logo (`assets/brand/logo.webp`) appears top-left on desktop and is the source for the favicon, touch and install icons, the social sharing image and the `image` in the structured data. To change it, replace that file and run `npm run icons`.

The site name is shown as a lockup: the Instagram wordmark from the capture followed by "Song Finder" (`components/SiteLockup.tsx`). The wordmark is a trademark of Meta Platforms, Inc. Meta's brand guidelines restrict using its marks inside another product's name or logo, so the owner of this site is responsible for that use; replacing the drawing with plain text is a one-component change.

The hero illustration is the owner-supplied image `public/hero.webp`. Meta's proprietary typefaces from the capture are not used: the reference's own system-font fallback is used for the interface and Figtree for the headline.

The capture folder `www.instagram.com-clone/` is git-ignored for the same reason and is not needed to build or run the site.

Every text input is at least 16px at every breakpoint, enforced globally in `app/globals.css` and checked by an end-to-end test, so iOS Safari does not zoom on focus.

## Deployment

The app is a standard Next.js project and runs on any Node.js host. On Vercel:

1. Import the GitHub repository into Vercel. The defaults (framework Next.js, build `next build`) are correct.
2. In **Settings → Environment Variables**, add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` for Production (and Preview if wanted).
3. In **Settings → Domains**, add `instagramsongfinder.theatom.lk`.
4. At the DNS provider for `theatom.lk`, create the record Vercel shows for that domain. For a subdomain this is a `CNAME`:

   | Type | Name | Value |
   | --- | --- | --- |
   | `CNAME` | `instagramsongfinder` | the target shown by Vercel (commonly `cname.vercel-dns.com`) |

5. Wait for Vercel to verify the domain and issue the HTTPS certificate, then redeploy if the environment variables were added after the first build.

After the first deployment:

- Search for a song, paste a Spotify link and paste an ISRC on the live site.
- Open `/robots.txt`, `/sitemap.xml` and `/opengraph-image`.
- Submit `https://instagramsongfinder.theatom.lk/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
- Validate the home page with the [Rich Results Test](https://search.google.com/test/rich-results) or the [Schema Markup Validator](https://validator.schema.org/).

Canonical URLs, the sitemap and social tags always use the production domain, set in `lib/site.ts`.
