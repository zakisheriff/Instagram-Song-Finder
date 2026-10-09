import { site } from "@/lib/site";

function mailto(subject: string, body: string): string {
  return `mailto:${site.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const BUG_REPORT = mailto(
  `Bug report: ${site.name}`,
  "What happened:\n\nWhat you expected:\n\nWhat you searched for or pasted:\n\nDevice and browser:\n",
);

const FEATURE_REQUEST = mailto(
  `Feature request: ${site.name}`,
  "What would you like to see:\n\nWhy it would help:\n",
);

interface FeedbackLinksProps {
  className?: string;
}

/** "Report a bug · Request a feature": both open an email to The Atom. */
export function FeedbackLinks({ className }: FeedbackLinksProps) {
  return (
    <p className={className ? `feedback ${className}` : "feedback"}>
      <a href={BUG_REPORT}>Report a bug</a>
      <span aria-hidden="true"> · </span>
      <a href={FEATURE_REQUEST}>Request a feature</a>
    </p>
  );
}
