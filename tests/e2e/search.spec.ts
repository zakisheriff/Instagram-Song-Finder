import {
  expect,
  expectNoHorizontalOverflow,
  failure,
  LIVE_TRACK,
  NO_ISRC_TRACK,
  results,
  searchBox,
  test,
  TRACK,
} from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("finds a song by title and copies the full isrc: string in one click", async ({
  page,
  mockSearch,
  copied,
}) => {
  const requested = await mockSearch(results([TRACK, LIVE_TRACK]));
  await searchBox(page).fill("die with a smile");

  const region = page.getByRole("region", { name: "Search results" });
  await expect(region.getByText("isrc:USUM72409273")).toBeVisible();
  await expect(region.getByText("Lady Gaga, Bruno Mars").first()).toBeVisible();
  await expect(region.getByText("Data from Spotify")).toBeVisible();
  expect(requested).toHaveLength(1);
  expect(new URL(requested[0]).searchParams.get("q")).toBe("die with a smile");

  await region.getByRole("button", { name: "Copy for Instagram" }).click();
  await expect(region.getByRole("button", { name: /Copied isrc:USUM72409273/ })).toBeVisible();
  expect(await copied()).toEqual(["isrc:USUM72409273"]);

  await region.getByRole("link", { name: "Copy and open Instagram" }).evaluate((link) => {
    link.addEventListener("click", (event) => event.preventDefault());
  });
  await region.getByRole("link", { name: "Copy and open Instagram" }).click();
  expect(await copied()).toEqual(["isrc:USUM72409273", "isrc:USUM72409273"]);
  await expect(region.getByRole("button", { name: /Copy ISRC only/ })).toHaveCount(0);
});

test("lets the visitor choose between recordings without merging them", async ({
  page,
  mockSearch,
  copied,
}) => {
  await mockSearch(results([TRACK, LIVE_TRACK]));
  await searchBox(page).fill("die with a smile");

  const region = page.getByRole("region", { name: "Search results" });
  const liveRow = region.getByRole("button", { name: /Live in Las Vegas/ });
  await expect(liveRow).toHaveAttribute("aria-expanded", "false");
  await liveRow.click();
  await expect(liveRow).toHaveAttribute("aria-expanded", "true");
  await expect(region.getByText("isrc:USUM72412854")).toBeVisible();

  await region.getByRole("button", { name: "Copy for Instagram" }).click();
  expect(await copied()).toEqual(["isrc:USUM72412854"]);
  await expectNoHorizontalOverflow(page);
});

test("submits with Enter and accepts a Spotify link with tracking parameters", async ({
  page,
  mockSearch,
}) => {
  const requested = await mockSearch(
    results([TRACK], { kind: "spotify-track", query: "2plbrEY59IikOBgBGLjaoe" }),
  );
  await searchBox(page).fill("https://open.spotify.com/track/2plbrEY59IikOBgBGLjaoe?si=abc123");
  await searchBox(page).press("Enter");

  await expect(page.getByText("Exact match for your Spotify link")).toBeVisible();
  expect(new URL(requested[0]).searchParams.get("q")).toContain("/track/2plbrEY59IikOBgBGLjaoe");
});

test("accepts a prefixed ISRC", async ({ page, mockSearch }) => {
  await mockSearch(results([TRACK], { kind: "isrc", query: "USUM72409273" }));
  await searchBox(page).fill("isrc:USUM72409273");
  await expect(page.getByText("Recordings with ISRC USUM72409273")).toBeVisible();
});

test("explains a missing ISRC instead of inventing one", async ({ page, mockSearch }) => {
  await mockSearch(results([NO_ISRC_TRACK]));
  await searchBox(page).fill("unreleased demo");
  await expect(page.getByText("ISRC unavailable for this recording.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy for Instagram" })).toHaveCount(0);
});

test("rejects invalid ISRCs and Spotify links before any request is made", async ({
  page,
  mockSearch,
}) => {
  const requested = await mockSearch(results([TRACK]));
  await searchBox(page).fill("isrc:12345");
  await searchBox(page).press("Enter");
  await expect(page.getByText(/doesn't look like a valid ISRC/)).toBeVisible();

  await searchBox(page).fill("https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy");
  await searchBox(page).press("Enter");
  await expect(page.getByText(/doesn't point to a track/)).toBeVisible();
  expect(requested).toHaveLength(0);
});

test("shows catalog outages and rate limits as readable errors", async ({ page, mockSearch }) => {
  await mockSearch(
    failure(502, "PROVIDER_UNAVAILABLE", "The music catalog is unavailable right now. Please try again shortly."),
  );
  await searchBox(page).fill("bad guy");
  await searchBox(page).press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "music catalog is unavailable" })).toBeVisible({
    timeout: 15_000,
  });

  await mockSearch(failure(429, "RATE_LIMITED", "Too many searches right now. Wait a moment and try again."));
  await searchBox(page).fill("bad guy billie");
  await searchBox(page).press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "Too many searches" })).toBeVisible({
    timeout: 15_000,
  });
  await expectNoHorizontalOverflow(page);
});

test("shows an empty state when nothing matches", async ({ page, mockSearch }) => {
  await mockSearch(results([]));
  await searchBox(page).fill("zzqqxxyy");
  await expect(page.getByText("No songs found", { exact: true })).toBeVisible();
});
