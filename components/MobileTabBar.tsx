"use client";

import { GlassNav } from "@zakisheriff/liquid-glass";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HomeIcon, InfoIcon, QuestionIcon, SearchIcon, StepsIcon } from "./icons";

interface MobileTabBarProps {
  /** Id of the search input to focus, when the current page has one. */
  searchInputId?: string;
}

type Tab = "home" | "search" | "how-it-works" | "faq" | "about";
type Section = Extract<Tab, "home" | "how-it-works" | "faq">;

/** The bar's tabs, left to right. */
const TABS: ReadonlyArray<{ tab: Tab; label: string; Icon: typeof HomeIcon }> = [
  { tab: "home", label: "Home", Icon: HomeIcon },
  { tab: "how-it-works", label: "How it works", Icon: StepsIcon },
  { tab: "faq", label: "Frequently asked questions", Icon: QuestionIcon },
  { tab: "about", label: "About", Icon: InfoIcon },
  { tab: "search", label: "Search for a song", Icon: SearchIcon },
];

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
  const router = useRouter();
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

  function focusSearch() {
    if (!searchInputId) return;
    const input = document.getElementById(searchInputId);
    input?.scrollIntoView({ block: "center" });
    input?.focus({ preventScroll: true });
  }

  function open(tab: Tab) {
    switch (tab) {
      case "home":
        if (onHome) window.scrollTo({ top: 0 });
        else router.push("/");
        return;
      case "how-it-works":
      case "faq":
        if (onHome) {
          document.getElementById(tab)?.scrollIntoView();
          history.replaceState(null, "", `#${tab}`);
        } else router.push(`/#${tab}`);
        return;
      case "about":
        router.push("/about");
        return;
      case "search":
        if (onHome) focusSearch();
        else router.push("/");
    }
  }

  const items = TABS.map(({ tab, label, Icon }) => ({
    label,
    icon: <Icon active={active === tab} />,
  }));

  return (
    <nav className="tabbar" aria-label="Sections">
      <GlassNav
        items={items}
        // With no tab current (a page outside the bar), the lens rests on Home.
        activeIndex={Math.max(0, TABS.findIndex(({ tab }) => tab === active))}
        onChange={(index) => open(TABS[index].tab)}
        showLabels={false}
        aria-label="Sections"
      />
    </nav>
  );
}
