import { site } from "@/lib/site";

function mailto(subject: string, body: string): string {
  return `mailto:${site.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const BUG_REPORT = mailto(
  `Bug report: ${site.name}`,
  "What happened:\n\nWhat you expected:\n\nWhat you searched for or pasted:\n\nDevice and browser:\n",
);

const MISSING_SONG = mailto(
  `Missing song: ${site.name}`,
  "Song title:\n\nArtist:\n\nSpotify link or ISRC, if you have one:\n",
);

interface FeedbackLinksProps {
  className?: string;
}

/** "Report a bug · Missing a song? Tell us.": both open an email to The Atom. */
export function FeedbackLinks({ className }: FeedbackLinksProps) {
  return (
    <p className={className ? `feedback ${className}` : "feedback"}>
      <a href={BUG_REPORT}>Report a bug</a>
      <span aria-hidden="true"> · </span>
      <a href={MISSING_SONG}>Missing a song? Tell us.</a>
    </p>
  );
}
