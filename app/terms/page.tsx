import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { SubPage } from "@/components/SubPage";
import { pageMetadata } from "@/lib/seo/metadata";
import { subPageGraph } from "@/lib/seo/structured-data";
import { site } from "@/lib/site";

const title = `Terms of Use – ${site.name} by ${site.publisher.name}`;
const description =
  "The terms for using Instagram Song Finder: a free ISRC lookup tool provided as is, with no guarantee of song availability on Instagram.";

export const metadata: Metadata = pageMetadata({ title, description, path: "/terms" });

export default function TermsPage() {
  return (
    <SubPage
      title="Terms of use"
      lead={`${site.name} is a free tool provided by ${site.publisher.name}. By using it you agree to the terms below.`}
    >
      <JsonLd data={subPageGraph({ path: "/terms", name: title, description, breadcrumbName: "Terms" })} />

      <h2>The service</h2>
      <p>
        The site looks up song metadata and ISRC codes from third-party music catalogs and displays
        them for your reference. It is provided as is, without warranties of any kind. Catalog data
        can be incomplete or wrong, and the service can be unavailable or rate limited at times.
      </p>

      <h2>No guarantee of Instagram availability</h2>
      <p>
        An ISRC identifies a recording. It does not grant any right to use that recording, and it
        does not mean the recording can be found, played or added on Instagram. You are responsible
        for complying with Instagram&apos;s terms and with the rights of music owners.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Use the site through its normal interface, at a reasonable rate.</li>
        <li>Do not scrape it, overload it or try to bypass its limits.</li>
        <li>Do not use it to build a copy of a third-party music catalog.</li>
      </ul>

      <h2>Third parties</h2>
      <p>
        {site.disclaimer} Song titles, artist names, artwork and other metadata belong to their
        respective owners and are shown only to identify recordings.
      </p>

      <h2>Changes</h2>
      <p>These terms may be updated as the service changes. The current version is always on this page.</p>
    </SubPage>
  );
}
