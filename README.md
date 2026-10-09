# <div align="center">Instagram Song Finder</div>

<div align="center">
<strong>Find any song's ISRC and copy it, ready for Instagram music search</strong>
</div>

<br />

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178c6?style=for-the-badge&logo=typescript&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-Vitest%20%2B%20Playwright-6e9f18?style=for-the-badge&logo=vitest&logoColor=white)

<br />

<a href="https://instagramsongfinder.theatom.lk">
<img src="https://img.shields.io/badge/View%20Live%20Site-Click%20Here-0064e0?style=for-the-badge&logo=safari&logoColor=white" height="50" />
</a>

<br />
<br />

**[Visit Live Site: https://instagramsongfinder.theatom.lk](https://instagramsongfinder.theatom.lk)**

</div>

<br />

> **"The right recording, not the nearest cover."**
>
> Instagram Song Finder turns a song name, an artist, a Spotify link or an ISRC into the exact recording's code.  
> One click copies `isrc:CODE`, ready to paste into Instagram's music search for Reels and Stories.

---

## 🌟 Vision

Instagram Song Finder's mission is to be:

- **A free, no-login tool** — search, pick the recording, copy the code
- **One search box for everything** — titles, artists, keywords, Spotify links, Spotify URIs and ISRCs
- **Honest about its data** — real catalog metadata only, and no promises about what Instagram carries

---

## ✨ Why Instagram Song Finder?

Searching Instagram's music picker by name often surfaces covers, remixes and sped-up edits before the original.  
An ISRC identifies **one specific recording**, so searching by code is a precise way to ask for the version you want.

> An ISRC identifies a sound recording. It does not mean Instagram has licensed or indexed that recording. Searching Instagram by ISRC is not an officially documented feature and can vary by account type, region and app version.

---

## 🎨 Reference-Faithful Design

- **Two-Column Hero**  
  Illustration and headline on the left, search panel on the right, each filling the first screen.

- **Measured Components**  
  60px fields with a 16px radius and floating label, 44px pill buttons, taken from the reference capture.

- **Phone Layout**  
  A centred landing that fills one screen, with a bottom tab bar that highlights the section in view.

- **No Input Zoom on iOS**  
  Every text input is at least 16px at every breakpoint, enforced globally and checked by a test.

---

## 🔎 Universal Search

- **Automatic Input Detection**  
  One box works out whether it was given text, a Spotify link, a share link, a URI or an ISRC.

- **Typo Tolerance**  
  Misspelled queries still find the song; when nothing matches, the closest results are shown and labelled.

- **Exact Recordings**  
  Live, remastered, remixed and sped-up versions are listed separately, each with its own ISRC.

- **No Invented Codes**  
  If a catalog has no ISRC for a recording, the site says "ISRC unavailable for this recording."

---

## 🎵 Real Music Data

- **Spotify Web API (primary)**  
  Client Credentials flow on the server; the ISRC is read from `external_ids.isrc`.

- **Deezer (fallback)**  
  Answers text and ISRC searches when Spotify is not configured, rate limited or down.

- **Labelled Sources**  
  Every response comes from a single catalog and is marked "Data from Spotify" or "Data from Deezer".

- **Spotify Requirements**  
  The Spotify account that owns the app needs an active Premium subscription, and Development Mode quota is small and shared. Spotify links and URIs can only be resolved through Spotify.

---

## 🔐 Security

- **Server-Only Credentials**  
  Spotify secrets never reach the browser and are validated at build time.

- **Validated Input**  
  Every query passes a shared detector and Zod schemas before any upstream call.

- **SSRF-Safe Share Links**  
  Redirects are followed manually, over HTTPS, one hop at a time, to an allowlist of Spotify hosts only.

- **Hardened Responses**  
  Content Security Policy, HSTS, frame denial, per-client rate limiting and short-lived caching.

---

## 📈 SEO, AEO and GEO

- **Metadata API**  
  Titles, descriptions, canonical URLs, Open Graph and Twitter cards, and a generated social image.

- **Crawl Files**  
  `/sitemap.xml`, `/robots.txt` (API routes disallowed), `/manifest.webmanifest` and `/llms.txt`.

- **Structured Data**  
  A JSON-LD graph with `Organization`, `WebSite`, `WebApplication`, `WebPage` and `BreadcrumbList`. No ratings, reviews or usage figures.

- **Answer Content**  
  A seven-step guide and ten direct-answer questions rendered on the server, in the page HTML.

---

## 📁 Project Structure

```
Instagram-Song-Finder/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Home: search, guide, FAQ
│   ├── about/ privacy/ terms/    # Informational pages
│   ├── api/
│   │   ├── search/route.ts       # Universal search endpoint
│   │   └── track/route.ts        # Exact lookup by Spotify link or ISRC
│   ├── sitemap.ts robots.ts manifest.ts
│   ├── opengraph-image.tsx       # Generated social card
│   └── globals.css               # Design tokens and all styles
│
├── components/                   # UI
│   ├── SongFinder.tsx            # Hero + search panel
│   ├── SearchResults.tsx         # Results list and states
│   ├── ResultItem.tsx            # One recording with copy actions
│   ├── TopAction.tsx             # Star on GitHub / Try now pill
│   └── MobileTabBar.tsx          # Bottom navigation on phones
│
├── hooks/                        # useSongSearch, useCopy
│
├── lib/
│   ├── search/                   # Input detection, ISRC helpers, resolution, typo tolerance
│   ├── spotify/                  # Auth, catalog client, share-link resolver
│   ├── deezer/                   # Fallback catalog client
│   ├── music/                    # Provider contracts, errors, registry
│   ├── api/                      # Route handlers and response contract
│   ├── seo/                      # Metadata and structured data
│   └── content/                  # FAQ and how-to copy
│
├── assets/brand/logo.webp        # Source logo for every icon
├── scripts/generate-icons.mjs    # Favicon and app icon generator
└── tests/
    ├── unit/                     # Vitest
    └── e2e/                      # Playwright
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v22.12+)
- **Spotify Developer app** owned by an account with Spotify Premium (optional: without it the Deezer fallback serves text and ISRC searches)

### 1. Clone the Repository

```bash
git clone https://github.com/zakisheriff/Instagram-Song-Finder.git
cd Instagram-Song-Finder
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the example file and fill in your Spotify credentials:

```bash
cp .env.example .env.local
```

```env
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
# Optional. Default: spotify,deezer
# MUSIC_PROVIDERS=spotify,deezer
```

Create the app at the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and select the Web API. Both values must be set together; the build fails if only one is present.

### 4. Run the Application

```bash
npm run dev
```

Visit **http://localhost:3000** 🎉

### 5. Run the Checks

```bash
npm run lint
npm run typecheck
npm run test
npx playwright install chromium webkit   # first time only
npm run test:e2e
```

---

## 🎯 Key Features

### For Visitors

✅ **Universal Search** — Title, artist, keywords, Spotify link, share link, URI or ISRC  
✅ **Search As You Type** — Debounced, cancellable, with loading and error states  
✅ **Typo Tolerance** — Misspellings still find the right song  
✅ **One-Click Copy** — Copies the full `isrc:CODE` string  
✅ **Copy and Open Instagram** — Copies the code, then opens Instagram  
✅ **Version Labels** — Live, Remastered, Remix, Sped up and more  
✅ **No Account** — No login, no tracking cookies  

### For Maintainers

✅ **Provider Layer** — Add a catalog by implementing one interface  
✅ **Automatic Fallback** — Keeps working when the primary catalog is unavailable  
✅ **Typed API** — Consistent success and error responses  
✅ **Full Test Suite** — Unit, component and cross-browser end-to-end tests  

---

## 🔧 Tech Stack

### Application
- **Next.js 16** — App Router, Server Components, Cache Components
- **React 19** — Client components for the interactive search
- **TypeScript** — Strict mode
- **Plain CSS** — Design tokens from the reference capture
- **Zod** — Input and environment validation

### Data
- **Spotify Web API** — Primary catalog
- **Deezer API** — Fallback catalog

### Quality
- **Vitest** + **Testing Library** — Unit and component tests
- **Playwright** — Desktop Chrome and Safari, iPhone Safari, Android Chrome, tablet
- **GitHub Actions** — Lint, typecheck, tests and build on every push

---

## 🔒 Security Features

✅ **Server-Side Secrets** — Never bundled for the browser  
✅ **Build-Time Environment Validation** — Broken configuration fails fast  
✅ **Restricted Outbound Hosts** — Spotify and Deezer APIs and Spotify share hosts only  
✅ **SSRF Protection** — Manual, allowlisted redirect following  
✅ **Rate Limiting** — 60 requests a minute per client, per server instance  
✅ **Security Headers** — CSP, HSTS, `X-Frame-Options`, `nosniff`  

The built-in rate limiter keeps its counters in server memory, so on serverless hosting each instance counts separately. For a hard global limit, add edge rate limiting at your host.

---

## 📜 API Documentation

### Endpoints
- `GET /api/search?q=<anything>&offset=<n>&provider=<spotify|deezer>` — Universal search
- `GET /api/track?url=<spotify link, share link or URI>` — Exact recording
- `GET /api/track?isrc=<code>` — Recordings with that ISRC

### Success

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

### Errors

```json
{ "ok": false, "error": { "code": "RATE_LIMITED", "message": "…", "retryAfterSeconds": 20 } }
```

- `INVALID_INPUT` (400) — Empty, too long, malformed ISRC, non-track or non-Spotify link
- `NOT_FOUND` (404) — No recording for that ISRC or track id
- `UNRESOLVABLE_LINK` (422) — A share link that could not be followed safely
- `RATE_LIMITED` (429) — Client or catalog rate limit, with `Retry-After`
- `PROVIDER_AUTH`, `PROVIDER_UNAVAILABLE` (502) — The catalog rejected or failed the request
- `NOT_CONFIGURED` (503) — No catalog can answer
- `PROVIDER_TIMEOUT` (504) — The catalog did not answer in time

---

## 🌐 Deployment

### Vercel
1. Import the GitHub repository; the Next.js defaults are correct
2. Add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` under **Settings → Environment Variables**
3. Add `instagramsongfinder.theatom.lk` under **Settings → Domains**

### DNS
1. At the DNS provider for `theatom.lk`, create the `CNAME` record Vercel shows for `instagramsongfinder`
2. Wait for Vercel to verify the domain and issue the HTTPS certificate
3. Redeploy if the environment variables were added after the first build

### After Going Live
1. Search by title, paste a Spotify link and paste an ISRC on the live site
2. Open `/robots.txt`, `/sitemap.xml` and `/opengraph-image`
3. Submit the sitemap in Google Search Console and Bing Webmaster Tools

---

## ⚖️ Third-Party Notes

- Instagram Song Finder is an independent tool by The Atom. It is not affiliated with, endorsed by or sponsored by Instagram, Meta or Spotify.
- The site name is shown with the Instagram wordmark, a trademark of Meta Platforms, Inc. Meta's brand guidelines restrict using its marks inside another product's name, so that use is the site owner's responsibility.
- Spotify's guidelines ask for a link back and attribution wherever its data is shown; results from Spotify keep an "Open in Spotify" button for that reason.
- Catalog responses are cached for a few minutes only. Nothing is stored long term.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

Found a bug or have an idea? Email **info@theatom.lk**.

---

## 📄 License

No open-source license has been added to this repository yet. Until one is, all rights are reserved by The Atom.

---

## ☕️ Support the Project

If Instagram Song Finder saved you time or helped you find the right track:

- Consider buying me a coffee
- It keeps development alive and motivates future updates

<div align="center">
<a href="https://buymeacoffee.com/theoneatom">
<img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" height="60" width="217">
</a>
</div>

---

<p align="center">
Made by <strong>Zaki Sheriff</strong>
</p>

<p align="center">
<em>Because the right song should be easy to find.</em>
</p>
