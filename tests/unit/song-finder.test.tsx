// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ImgHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SongFinder } from "@/components/SongFinder";
import type { SearchApiResponse, SearchSuccess } from "@/lib/api/contract";
import { copyText } from "@/lib/clipboard";
import type { Track } from "@/lib/music/types";
import { track } from "./helpers/stub-provider";

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={String(src)} alt={alt} width={width} height={height} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const success = (tracks: Track[], extra: Partial<SearchSuccess> = {}): SearchSuccess => ({
  ok: true,
  kind: "text",
  query: "die with a smile",
  provider: { id: "spotify", name: "Spotify" },
  tracks,
  nextOffset: null,
  total: tracks.length,
  ...extra,
});

function mockApi(...responses: Array<{ status?: number; body: SearchApiResponse }>) {
  const queue = [...responses];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    void init;
    const next = queue.length > 1 ? queue.shift()! : queue[0];
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const requestedParams = (fetchMock: ReturnType<typeof mockApi>, call = 0) =>
  new URL(String(fetchMock.mock.calls[call][0]), "https://site.test").searchParams;

function setup() {
  const user = userEvent.setup();
  render(<SongFinder headline={<h1>Find songs on Instagram by their ISRC code.</h1>} />);
  const input = screen.getByRole("searchbox", { name: "Song, artist, Spotify link or ISRC" });
  return { user, input };
}

afterEach(() => {
  cleanup();
});

describe("SongFinder", () => {
  it("offers one labelled universal search box", () => {
    mockApi({ body: success([]) });
    const { input } = setup();
    expect(input).toHaveAttribute("type", "search");
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute("aria-disabled", "true");
  });

  it("debounces typing into a single request and shows the recording", async () => {
    const fetchMock = mockApi({ body: success([track()]) });
    const { user, input } = setup();

    await user.type(input, "die with a smile");
    expect(fetchMock).not.toHaveBeenCalled();

    const results = await screen.findByRole("region", { name: "Search results" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedParams(fetchMock).get("q")).toBe("die with a smile");

    expect(within(results).getAllByText("Die With A Smile").length).toBeGreaterThan(0);
    expect(within(results).getAllByText("Lady Gaga, Bruno Mars").length).toBeGreaterThan(0);
    expect(within(results).getByText("isrc:USUM72409273")).toBeInTheDocument();
    expect(within(results).getByText("US-UM7-24-09273")).toBeInTheDocument();
    expect(within(results).getByText("Data from Spotify")).toBeInTheDocument();
  });

  it("copies the full isrc: string with the main button and confirms it", async () => {
    mockApi({ body: success([track()]) });
    const { user, input } = setup();
    await user.type(input, "die with a smile");

    await user.click(await screen.findByRole("button", { name: "Copy for Instagram" }));

    expect(await navigator.clipboard.readText()).toBe("isrc:USUM72409273");
    expect(await screen.findByRole("button", { name: /Copied isrc:USUM72409273/ })).toBeInTheDocument();
    expect(screen.getByText("Copied to clipboard.")).toBeInTheDocument();
  });

  it("copies the code when the code box itself is pressed", async () => {
    mockApi({ body: success([track()]) });
    const { user, input } = setup();
    await user.type(input, "die with a smile");

    await user.click(await screen.findByRole("button", { name: "Copy code isrc:USUM72409273" }));
    expect(await navigator.clipboard.readText()).toBe("isrc:USUM72409273");
    expect(await screen.findByText("Copied to clipboard")).toBeInTheDocument();
  });

  it("offers a shortcut that copies the code and opens Instagram", async () => {
    mockApi({ body: success([track()]) });
    const { user, input } = setup();
    await user.type(input, "die with a smile");

    const shortcut = await screen.findByRole("link", { name: "Copy and open Instagram" });
    expect(shortcut).toHaveAttribute("href", "https://www.instagram.com/");
    expect(shortcut).toHaveAttribute("target", "_blank");
    await user.click(shortcut);
    expect(await navigator.clipboard.readText()).toBe("isrc:USUM72409273");
  });

  it("links back to Spotify but shows no source button for other catalogs", async () => {
    mockApi({
      body: success([track({ provider: "deezer", url: "https://www.deezer.com/track/1" })], {
        provider: { id: "deezer", name: "Deezer" },
      }),
    });
    const { user, input } = setup();
    await user.type(input, "die with a smile");
    await screen.findByRole("button", { name: "Copy for Instagram" });
    expect(screen.queryByRole("link", { name: /Open in/ })).not.toBeInTheDocument();
  });

  it("tells the visitor when only close matches were found", async () => {
    mockApi({ body: success([track()], { approximate: true }) });
    const { user, input } = setup();
    await user.type(input, "die with a smile zzqq");
    expect(await screen.findByText("No exact match. Showing the closest results")).toBeInTheDocument();
  });

  it("submits immediately on Enter without waiting for the debounce", async () => {
    const fetchMock = mockApi({ body: success([track()]) });
    const { user, input } = setup();
    await user.type(input, "bad guy{Enter}");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await screen.findByRole("region", { name: "Search results" });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends Spotify links and ISRC codes through the same box", async () => {
    const fetchMock = mockApi({
      body: success([track()], { kind: "spotify-track", query: "2plbrEY59IikOBgBGLjaoe" }),
    });
    const { user, input } = setup();
    await user.click(input);
    await user.paste("https://open.spotify.com/track/2plbrEY59IikOBgBGLjaoe?si=abc");
    expect(await screen.findByText("Exact match for your Spotify link")).toBeInTheDocument();
    expect(requestedParams(fetchMock).get("q")).toContain("open.spotify.com/track/2plbrEY59IikOBgBGLjaoe");
  });

  it("lists each recording separately and lets the visitor pick one", async () => {
    mockApi({
      body: success([
        track(),
        track({
          id: "spotify:live",
          title: "Die With A Smile (Live in Las Vegas)",
          isrc: "USUM72412854",
          versionTags: ["Live"],
        }),
      ]),
    });
    const { user, input } = setup();
    await user.type(input, "die with a smile");

    const rows = await screen.findAllByRole("button", { expanded: false });
    const liveRow = rows.find((row) => row.textContent?.includes("Live in Las Vegas"))!;
    expect(within(liveRow).getByText("Live")).toBeInTheDocument();
    const results = screen.getByRole("region", { name: "Search results" });
    expect(within(results).getByText("isrc:USUM72409273")).toBeInTheDocument();

    await user.click(liveRow);
    expect(within(results).getByText("isrc:USUM72412854")).toBeInTheDocument();
    // The previous panel is removed once its closing animation has finished.
    await waitFor(() =>
      expect(within(results).queryByText("isrc:USUM72409273")).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Copy for Instagram" }));
    expect(await navigator.clipboard.readText()).toBe("isrc:USUM72412854");
  });

  it("says so when a recording has no ISRC and offers no fake code", async () => {
    mockApi({ body: success([track({ isrc: null })]) });
    const { user, input } = setup();
    await user.type(input, "rare b-side");

    expect(await screen.findByText("ISRC unavailable for this recording.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy for Instagram" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^isrc:[A-Z0-9]/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open in Spotify/ })).toHaveAttribute(
      "href",
      "https://open.spotify.com/track/2plbrEY59IikOBgBGLjaoe",
    );
  });

  it("validates malformed codes and links locally, without calling the API", async () => {
    const fetchMock = mockApi({ body: success([]) });
    const { user, input } = setup();
    await user.type(input, "isrc:12345{Enter}");
    expect(await screen.findByText(/doesn't look like a valid ISRC/)).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");

    await user.clear(input);
    await user.type(input, "https://open.spotify.com/track/nope{Enter}");
    expect(await screen.findByText(/isn't a valid track link/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows provider errors and rate limiting as accessible alerts", async () => {
    mockApi(
      {
        status: 502,
        body: {
          ok: false,
          error: { code: "PROVIDER_UNAVAILABLE", message: "The music catalog is unavailable right now. Please try again shortly." },
        },
      },
      {
        status: 429,
        body: {
          ok: false,
          error: { code: "RATE_LIMITED", message: "Too many searches right now. Wait a moment and try again.", retryAfterSeconds: 20 },
        },
      },
    );
    const { user, input } = setup();
    await user.type(input, "bad guy{Enter}");
    const message = await screen.findByText(/music catalog is unavailable/);
    expect(message.closest('[role="alert"]')).not.toBeNull();

    await user.type(input, " billie{Enter}");
    expect(await screen.findByText(/Too many searches right now/)).toBeInTheDocument();
  });

  it("shows a helpful empty state when nothing matches", async () => {
    mockApi({ body: success([]) });
    const { user, input } = setup();
    await user.type(input, "zzqqxx{Enter}");
    expect(await screen.findByText("No songs found")).toBeInTheDocument();
  });

  it("loads more results from the same provider", async () => {
    const fetchMock = mockApi(
      { body: success([track()], { nextOffset: 10, provider: { id: "deezer", name: "Deezer" } }) },
      { body: success([track({ id: "deezer:2", title: "Second page song" })]) },
    );
    const { user, input } = setup();
    await user.type(input, "die with a smile{Enter}");

    await user.click(await screen.findByRole("button", { name: "Show more results" }));
    expect(await screen.findByText("Second page song")).toBeInTheDocument();

    const params = requestedParams(fetchMock, 1);
    expect(params.get("offset")).toBe("10");
    expect(params.get("provider")).toBe("deezer");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Show more results" })).not.toBeInTheDocument(),
    );
  });

  it("clears the search and results", async () => {
    mockApi({ body: success([track()]) });
    const { user, input } = setup();
    await user.type(input, "die with a smile{Enter}");
    await screen.findByRole("region", { name: "Search results" });

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(input).toHaveValue("");
    expect(screen.queryByRole("region", { name: "Search results" })).not.toBeInTheDocument();
    expect(input).toHaveFocus();
  });
});

describe("copyText", () => {
  it("falls back to a temporary 16px textarea when the Clipboard API is unavailable", async () => {
    vi.stubGlobal("navigator", { clipboard: undefined });
    let fontSize = "";
    const execCommand = vi.fn(() => {
      fontSize = document.querySelector("textarea")?.style.fontSize ?? "";
      return true;
    });
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });

    expect(await copyText("isrc:USUM72409273")).toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(fontSize).toBe("16px");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("reports failure instead of pretending the copy worked", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    Object.defineProperty(document, "execCommand", { value: vi.fn(() => false), configurable: true });
    expect(await copyText("isrc:USUM72409273")).toBe(false);
  });
});
