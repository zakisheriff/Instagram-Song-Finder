"use client";

import { useEffect, useState } from "react";
import { site } from "@/lib/site";

interface TopActionProps {
  /** Id of the search input that "Try now" returns to. */
  searchInputId: string;
}

/** The hero counts as passed once its bottom edge is this close to the top of the viewport. */
const PASSED_OFFSET = 80;

/**
 * Pill in the top-right corner of the home page. At the top it links to the
 * project on GitHub; once the visitor scrolls past the hero it becomes a
 * "Try now" button that brings them back to the search box.
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
        <button type="button" className="top-action__button top-action__button--try" onClick={tryNow}>
          Try now
        </button>
      ) : (
        <a
          className="top-action__button"
          href={site.repository}
          target="_blank"
          rel="noopener noreferrer"
        >
          Star on GitHub
        </a>
      )}
    </div>
  );
}
