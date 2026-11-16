"use client";

import { GlassButton } from "@zakisheriff/liquid-glass";
import { useEffect, useState } from "react";
import { site } from "@/lib/site";

interface TopActionProps {
  /** Id of the search input that "Try now" returns to. */
  searchInputId: string;
}

/** The hero counts as passed once its bottom edge is this close to the top of the viewport. */
const PASSED_OFFSET = 80;

/**
 * Glass pill in the top-right corner of the home page. At the top it links to
 * the project on GitHub; once the visitor scrolls past the hero it becomes a
 * filled "Try now" button that brings them back to the search box.
 */
export function TopAction({ searchInputId }: TopActionProps) {
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const hero = document.querySelector(".split");
        setPastHero(hero ? hero.getBoundingClientRect().bottom < PASSED_OFFSET : false);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  function tryNow() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById(searchInputId)?.focus({ preventScroll: true });
  }

  return (
    <div className="top-action">
      {pastHero ? (
        <GlassButton key="try" type="button" variant="filled" size="sm" onClick={tryNow}>
          Try now
        </GlassButton>
      ) : (
        <GlassButton
          key="star"
          size="sm"
          href={site.repository}
          target="_blank"
          rel="noopener noreferrer"
        >
          Star on GitHub
        </GlassButton>
      )}
    </div>
  );
}
