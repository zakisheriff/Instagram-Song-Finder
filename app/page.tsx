import type { Metadata } from "next";
import { AboutSection } from "@/components/AboutSection";
import { FaqSection } from "@/components/FaqSection";
import { HowToSection } from "@/components/HowToSection";
import { JsonLd } from "@/components/JsonLd";
import { LinksSection } from "@/components/LinksSection";
import { MobileTabBar } from "@/components/MobileTabBar";
import { SiteFooter } from "@/components/SiteFooter";
import { SongFinder } from "@/components/SongFinder";
import { TopAction } from "@/components/TopAction";
import { SEARCH_INPUT_ID } from "@/lib/search/constants";
import { pageMetadata } from "@/lib/seo/metadata";
import { homeGraph } from "@/lib/seo/structured-data";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: site.title,
  description: site.description,
  path: "/",
});

export default function HomePage() {
  return (
    <div className="page">
      <JsonLd data={homeGraph()} />
      <TopAction searchInputId={SEARCH_INPUT_ID} />
      <main id="main">
        <SongFinder
          headline={
            <h1 className="hero__headline" id="hero-headline">
              <span className="hero__headline-line">Find songs on Instagram by their </span>
              <span className="hero__headline-line">
                <span className="gradient-text">ISRC code</span>.
              </span>
            </h1>
          }
        />
        <hr className="rule" />
        <HowToSection />
        <hr className="rule" />
        <LinksSection />
        <hr className="rule" />
        <FaqSection />
        <hr className="rule" />
        <AboutSection />
      </main>
      <hr className="rule" />
      <SiteFooter />
      <MobileTabBar searchInputId={SEARCH_INPUT_ID} />
    </div>
  );
}
