"use client";

import Link from "next/link";
import { HomeIcon, InfoIcon, QuestionIcon, SearchIcon, StepsIcon } from "./icons";

interface MobileTabBarProps {
  /** Id of the search input to focus, when the current page has one. */
  searchInputId?: string;
}

/** Bottom navigation shown on phones, matching the reference's five-slot bar. */
export function MobileTabBar({ searchInputId }: MobileTabBarProps) {
  const onHome = Boolean(searchInputId);

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
          <Link href="/" aria-label="Home">
            <HomeIcon />
          </Link>
        </li>
        <li>
          {onHome ? (
            <button type="button" aria-label="Search for a song" onClick={focusSearch}>
              <SearchIcon />
            </button>
          ) : (
            <Link href="/" aria-label="Search for a song">
              <SearchIcon />
            </Link>
          )}
        </li>
        <li>
          <Link href="/#how-it-works" aria-label="How it works">
            <StepsIcon />
          </Link>
        </li>
        <li>
          <Link href="/#faq" aria-label="Frequently asked questions">
            <QuestionIcon />
          </Link>
        </li>
        <li>
          <Link href="/about" aria-label="About">
            <InfoIcon />
          </Link>
        </li>
      </ul>
    </nav>
  );
}
