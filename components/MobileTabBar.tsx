"use client";

import { GlassNav } from "@zakisheriff/liquid-glass";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  // The tab just tapped. It stays lit while the page scrolls or loads there, so
  // the highlight goes straight to it instead of passing every tab on the way.
  const [target, setTarget] = useState<Tab | null>(null);
  const release = useRef<() => void>(() => {});

  // Load the other pages ahead of time so tapping a tab opens them at once.
  useEffect(() => {
    router.prefetch("/about");
    router.prefetch("/");
  }, [router]);

  useEffect(() => () => release.current(), []);

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
  if (target) active = target;

  /** Keeps `tab` lit until the scroll it started comes to rest. */
  function holdUntilScrollEnds(tab: Tab) {
    release.current();
    setTarget(tab);
    let timer = 0;
    const done = () => {
      window.clearTimeout(timer);
      window.removeEventListener("scrollend", done);
      setTarget(null);
    };
    // Browsers without `scrollend`, and taps that need no scroll, fall back to a timer.
    timer = window.setTimeout(done, 1200);
    window.addEventListener("scrollend", done);
    release.current = () => {
      window.clearTimeout(timer);
      window.removeEventListener("scrollend", done);
    };
  }

  /** Smooth unless the visitor has asked for reduced motion. */
  function scrollBehavior(): ScrollBehavior {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  }

  function focusSearch() {
    if (!searchInputId) return;
    const input = document.getElementById(searchInputId);
    input?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
    input?.focus({ preventScroll: true });
  }

  function open(tab: Tab) {
    // On another page the tab lights up at once and stays lit while the page loads.
    if (!onHome) {
      release.current();
      setTarget(tab);
      router.push(tab === "how-it-works" || tab === "faq" ? `/#${tab}` : tab === "about" ? "/about" : "/");
      return;
    }
    switch (tab) {
      case "home":
        holdUntilScrollEnds(tab);
        window.scrollTo({ top: 0, behavior: scrollBehavior() });
        history.replaceState(null, "", "/");
        return;
      case "how-it-works":
      case "faq":
        holdUntilScrollEnds(tab);
        document.getElementById(tab)?.scrollIntoView({ block: "start", behavior: scrollBehavior() });
        history.replaceState(null, "", `#${tab}`);
        return;
      case "about":
        release.current();
        setTarget(tab);
        router.push("/about");
        return;
      case "search":
        holdUntilScrollEnds(tab);
        focusSearch();
    }
  }

  // The glass lens draws the filled icon wherever it covers a tab, so each
  // tab gives both looks and the bar picks between them.
  const items = TABS.map(({ label, Icon }) => ({
    label,
    icon: <Icon />,
    activeIcon: <Icon active />,
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
