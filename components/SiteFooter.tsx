import Link from "next/link";
import { site } from "@/lib/site";

const LINKS: ReadonlyArray<{ href: string; label: string; external?: boolean }> = [
  { href: site.publisher.url, label: site.publisher.name, external: true },
  { href: "/about", label: "About" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#supported-links", label: "Supported links" },
  { href: "/#faq", label: "FAQ" },
  { href: "/#what-is-an-isrc", label: "What is an ISRC?" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function SiteFooter() {
  return (
    <footer className="footer">
      <nav aria-label="Footer">
        <ul className="footer__links">
          {LINKS.map((link) => (
            <li key={link.href}>
              {link.external ? (
                <a href={link.href} target="_blank" rel="noopener">
                  {link.label}
                </a>
              ) : (
                <Link href={link.href}>{link.label}</Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <p className="footer__meta">
        <span>
          © {site.copyrightYear} {site.name} by {site.publisher.name}
        </span>
      </p>
    </footer>
  );
}
