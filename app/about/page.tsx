import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { SubPage } from "@/components/SubPage";
import { pageMetadata } from "@/lib/seo/metadata";
import { subPageGraph } from "@/lib/seo/structured-data";
import { site } from "@/lib/site";

const title = `About ${site.name} – ISRC Lookup Tool by The Atom`;
const description =
  "What Instagram Song Finder is, who publishes it, where its song and ISRC data comes from, and what an ISRC lookup can and cannot tell you about Instagram.";

export const metadata: Metadata = pageMetadata({ title, description, path: "/about" });

export default function AboutPage() {
  return (
    <SubPage
      title={`About ${site.name}`}
      lead={`${site.name} is a free web tool that finds the ISRC code of a song and formats it for Instagram's music search. It is published by ${site.publisher.name}.`}
    >
      <JsonLd
        data={subPageGraph({
          path: "/about",
          name: title,
          description,
          type: "AboutPage",
          breadcrumbName: "About",
        })}
      />

      <h2>What it does</h2>
      <p>
        You can search with a song title, an artist name, keywords or an ISRC, or paste a song link
        from Spotify, Apple Music, YouTube, YouTube Music, Deezer or SoundCloud. The tool returns the matching recordings with their artwork, artist, album
        and ISRC, and copies the code in the form <code>isrc:XXXXXXXXXXXX</code> so it can be
        pasted into Instagram&apos;s music search.
      </p>

      <h2>Who makes it</h2>
      <p>
        The site is built and published by{" "}
        <a href={site.publisher.url} target="_blank" rel="noopener">
          {site.publisher.name}
        </a>
        . Its address is <strong>{site.domain}</strong>.
      </p>

      <h2>Where the data comes from</h2>
      <ul>
        <li>
          <strong>Spotify.</strong> Where the integration is available, results come from the
          official Spotify Web API, and the ISRC is the value Spotify lists for that track.
        </li>
        <li>
          <strong>Deezer.</strong> If Spotify is not available, text and ISRC searches may be
          answered from Deezer&apos;s public catalog instead.
        </li>
        <li>
          <strong>Links from other services.</strong> A pasted link is only used to identify the
          song: Apple&apos;s public lookup gives its title, artist and length, and YouTube and
          SoundCloud give its title. The recording and its ISRC are then found in the catalogs
          above, and you confirm the match.
        </li>
      </ul>
      <p>
        Every result is labelled with its source. Codes are displayed exactly as the catalog
        reports them. When a catalog has no ISRC for a recording, the site says so instead of
        showing a guess.
      </p>

      <h2>What an ISRC lookup can and cannot tell you</h2>
      <p>
        An ISRC identifies one sound recording. It does not show whether Instagram has licensed
        that recording, and there is no public Instagram service that reports availability.
        Searching Instagram by ISRC is not an officially documented feature, so results can vary
        by account type, region and app version. {site.name} makes no promise that a song can be
        found or used on Instagram.
      </p>

      <h2>Independence</h2>
      <p>
        {site.disclaimer} Instagram is a trademark of Meta Platforms, Inc. Spotify is a trademark
        of Spotify AB. Album artwork and metadata belong to their respective owners.
      </p>

      <h2>More</h2>
      <p>
        See <Link href="/#how-it-works">how to use an ISRC on Instagram</Link>, the{" "}
        <Link href="/#faq">frequently asked questions</Link>, the{" "}
        <Link href="/privacy">privacy notice</Link> and the <Link href="/terms">terms of use</Link>.
      </p>
    </SubPage>
  );
}
