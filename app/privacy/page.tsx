import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { SubPage } from "@/components/SubPage";
import { pageMetadata } from "@/lib/seo/metadata";
import { subPageGraph } from "@/lib/seo/structured-data";
import { site } from "@/lib/site";

const title = `Privacy – ${site.name}`;
const description =
  "How Instagram Song Finder handles your searches: no accounts, no advertising cookies, and what is shared with the music catalogs that answer your query.";

export const metadata: Metadata = pageMetadata({ title, description, path: "/privacy" });

export default function PrivacyPage() {
  return (
    <SubPage
      title="Privacy"
      lead={`${site.name} is designed to work without collecting personal information. This notice explains what happens to the data involved in a search.`}
    >
      <JsonLd data={subPageGraph({ path: "/privacy", name: title, description, breadcrumbName: "Privacy" })} />

      <h2>No account, no sign-in</h2>
      <p>
        You never create an account or log in, and the site does not ask for your Instagram or
        Spotify credentials. It sets no advertising or tracking cookies.
      </p>

      <h2>Your searches</h2>
      <p>
        What you type into the search box is sent to this site&apos;s server so it can be looked
        up. The server forwards the query to the music catalog that answers it (Spotify or Deezer).
        The request is made by the server, so those services receive the search text but not your
        IP address. Results may be cached briefly to keep the site fast; the cache is keyed by the
        search text only.
      </p>

      <h2>Voice search</h2>
      <p>
        The microphone button uses the speech recognition built into your browser and only
        listens after you tap it. This site does not record or store audio; it receives the
        recognised text only. Depending on your browser, the audio may be processed by the browser
        maker&apos;s servers, for example Google&apos;s in Chrome or Apple&apos;s in Safari.
      </p>

      <h2>Technical data</h2>
      <p>
        Your IP address is used in memory for a short time to limit abusive request rates. The
        hosting provider may keep standard server logs, such as IP address, time and requested
        URL, for security and reliability.
      </p>

      <h2>Visitor statistics</h2>
      <p>
        The site uses Vercel Web Analytics to count visits and page views. It works without
        cookies and does not identify individual visitors or follow them across other sites.
      </p>

      <h2>Album artwork</h2>
      <p>
        Cover images load directly from the image servers of Spotify or Deezer. Those services can
        see the usual connection details of your browser when an image loads.
      </p>

      <h2>Song previews</h2>
      <p>
        Preview clips play only when you press Play, and stream directly from the music
        catalog&apos;s own servers, the same way cover images do.
      </p>

      <h2>Clipboard</h2>
      <p>
        The site writes to your clipboard only when you press a copy button. It never reads your
        clipboard.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this notice can be sent to {site.publisher.name} through{" "}
        <a href={site.publisher.url} target="_blank" rel="noopener">
          theatom.lk
        </a>
        .
      </p>
    </SubPage>
  );
}
