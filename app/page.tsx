import { MobileTabBar } from "@/components/MobileTabBar";
import { SiteFooter } from "@/components/SiteFooter";
import { SongFinder } from "@/components/SongFinder";
import { SEARCH_INPUT_ID } from "@/lib/search/constants";

export default function HomePage() {
  return (
    <div className="page">
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
      </main>
      <hr className="rule" />
      <SiteFooter />
      <MobileTabBar searchInputId={SEARCH_INPUT_ID} />
    </div>
  );
}
