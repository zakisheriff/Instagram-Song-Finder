"use client";

import { useEffect, useRef, useState } from "react";
import { site } from "@/lib/site";

interface TopActionProps {
  /** Id of the search input that "Try now" returns to. */
  searchInputId: string;
}

/** The hero counts as passed once its bottom edge is this close to the top of the viewport. */
const PASSED_OFFSET = 80;

/**
 * Pill in the top-right corner of the home page. At the top it links to the
 * project on GitHub; once the visitor scrolls past the hero it morphs into a
 * "Try now" button that brings them back to the search box. One shell changes
 * width and colour while the two labels cross-fade inside it.
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

  // Each label is measured so the pill can glide between the two exact widths.
  const shell = useRef<HTMLDivElement>(null);
  const starLabel = useRef<HTMLAnchorElement>(null);
  const tryLabel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const measure = () => {
      if (!shell.current || !starLabel.current || !tryLabel.current) return;
      shell.current.style.setProperty("--star-width", `${Math.ceil(starLabel.current.scrollWidth)}px`);
      shell.current.style.setProperty("--try-width", `${Math.ceil(tryLabel.current.scrollWidth)}px`);
    };
    measure();
    void document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  function tryNow() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById(searchInputId)?.focus({ preventScroll: true });
  }

  return (
    <div ref={shell} className={`top-action${pastHero ? " is-try" : ""}`}>
      <a
        ref={starLabel}
        className="top-action__label top-action__label--star"
        href={site.repository}
        target="_blank"
        rel="noopener noreferrer"
        inert={pastHero}
        aria-hidden={pastHero}
      >
        Star on GitHub
      </a>
      <button
        ref={tryLabel}
        type="button"
        className="top-action__label top-action__label--try"
        onClick={tryNow}
        inert={!pastHero}
        aria-hidden={!pastHero}
      >
        Try now
      </button>
    </div>
  );
}
