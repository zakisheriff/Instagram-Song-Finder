import Link from "next/link";
import type { ReactNode } from "react";
import { site } from "@/lib/site";
import { BrandMark } from "./BrandMark";
import { MobileTabBar } from "./MobileTabBar";
import { SiteFooter } from "./SiteFooter";

interface SubPageProps {
  title: string;
  lead?: string;
  children: ReactNode;
}

/** Shared frame for the informational pages. */
export function SubPage({ title, lead, children }: SubPageProps) {
  return (
    <div className="page">
      <header className="subpage__header">
        <Link className="subpage__logo" href="/">
          <BrandMark size={36} />
          {site.name}
        </Link>
      </header>
      <main id="main" className="content prose">
        <h1 className="content__title">{title}</h1>
        {lead && <p className="content__lead">{lead}</p>}
        {children}
        <Link className="button button--primary subpage__back" href="/">
          Find a song
        </Link>
      </main>
      <hr className="rule" />
      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}
