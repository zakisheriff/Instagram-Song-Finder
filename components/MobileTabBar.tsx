"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { HomeIcon, InfoIcon, QuestionIcon, SearchIcon, StepsIcon } from "./icons";

interface MobileTabBarProps {
  /** Id of the search input to focus, when the current page has one. */
  searchInputId?: string;
}

type Tab = "home" | "search" | "how-it-works" | "faq" | "about";
type Section = Extract<Tab, "home" | "how-it-works" | "faq">;

/** Sections of the home page, in the order they appear. */
const SECTION_IDS: ReadonlyArray<Exclude<Section, "home">> = ["how-it-works", "faq"];

/** A section counts as current once its top passes this fraction of the viewport. */
const ACTIVATION_LINE = 0.4;

function currentSection(): Section {
  let current: Section = "home";
  for (const id of SECTION_IDS) {
    const top = document.getElementById(id)?.getBoundingClientRect().top;
    if (top !== undefined && top <= window.innerHeight * ACTIVATION_LINE) current = id;
  }
  return current;
}

/**
 * Bottom navigation shown on phones, matching the reference's five-slot bar.
 * The highlighted tab follows what the visitor is looking at: the section in
 * view on the home page, the search field while it has focus, or the About page.
 */
export function MobileTabBar({ searchInputId }: MobileTabBarProps) {
  const pathname = usePathname();
  const onHome = Boolean(searchInputId);
  const [section, setSection] = useState<Section>("home");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!onHome) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setSection(currentSection()));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [onHome]);

  useEffect(() => {
    const input = searchInputId ? document.getElementById(searchInputId) : null;
    if (!input) return;
    const onFocus = () => setSearching(true);
    const onBlur = () => setSearching(false);
    input.addEventListener("focus", onFocus);
    input.addEventListener("blur", onBlur);
    return () => {
      input.removeEventListener("focus", onFocus);
      input.removeEventListener("blur", onBlur);
    };
  }, [searchInputId]);

  let active: Tab | null = null;
  if (onHome) active = searching ? "search" : section;
  else if (pathname === "/about") active = "about";

  const current = (tab: Tab) => (active === tab ? ("true" as const) : undefined);

  function focusSearch() {
    if (!searchInputId) return;
    const input = document.getElementById(searchInputId);
    input?.scrollIntoView({ block: "center" });
    input?.focus({ preventScroll: true });
  }

  return (
    <nav className="tabbar" aria-label="Sections">
      <ul>
        <li>
          <Link
            href="/"
            aria-label="Home"
            aria-current={current("home")}
            onClick={() => {
              if (onHome) window.scrollTo({ top: 0 });
            }}
          >
            <HomeIcon active={active === "home"} />
          </Link>
        </li>
        <li>
          {onHome ? (
            <button
              type="button"
              aria-label="Search for a song"
              aria-current={current("search")}
              onClick={focusSearch}
            >
              <SearchIcon active={active === "search"} />
            </button>
          ) : (
            <Link href="/" aria-label="Search for a song">
              <SearchIcon />
            </Link>
          )}
        </li>
        <li>
          <Link href="/#how-it-works" aria-label="How it works" aria-current={current("how-it-works")}>
            <StepsIcon active={active === "how-it-works"} />
          </Link>
        </li>
        <li>
          <Link href="/#faq" aria-label="Frequently asked questions" aria-current={current("faq")}>
            <QuestionIcon active={active === "faq"} />
          </Link>
        </li>
        <li>
          <Link href="/about" aria-label="About" aria-current={active === "about" ? "page" : undefined}>
            <InfoIcon active={active === "about"} />
          </Link>
        </li>
      </ul>
    </nav>
  );
}
