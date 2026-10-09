import {
  expect,
  expectNoHorizontalOverflow,
  isPhoneLayout,
  LIVE_TRACK,
  results,
  searchBox,
  test,
  TRACK,
} from "./fixtures";

const PAGES = ["/", "/about", "/privacy", "/terms"];

test("every text control is at least 16px, so iOS never zooms on focus", async ({
  page,
  mockSearch,
}) => {
  await mockSearch(results([TRACK, LIVE_TRACK]));
  for (const path of PAGES) {
    await page.goto(path);
    if (path === "/") {
      await searchBox(page).fill("die with a smile");
      await expect(page.getByText("isrc:USUM72409273").last()).toBeVisible();
    }
    const sizes = await page.evaluate(() =>
      Array.from(document.querySelectorAll("input, textarea, select")).map((element) =>
        parseFloat(getComputedStyle(element).fontSize),
      ),
    );
    for (const size of sizes) expect(size, `control on ${path}`).toBeGreaterThanOrEqual(16);
    if (path === "/") expect(sizes.length).toBeGreaterThan(0);
  }
});

test("no page scrolls horizontally, with or without results", async ({ page, mockSearch }) => {
  await mockSearch(results([TRACK, LIVE_TRACK]));
  for (const path of PAGES) {
    await page.goto(path);
    await expectNoHorizontalOverflow(page);
  }
  await page.goto("/");
  await searchBox(page).fill("die with a smile");
  await expect(page.getByText("isrc:USUM72409273").last()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("uses the two-column reference layout on desktop and the stacked one on phones", async ({
  page,
}) => {
  await page.goto("/");
  const collage = page.locator(".collage");
  const tabBar = page.getByRole("navigation", { name: "Sections" });

  if (isPhoneLayout(page)) {
    await expect(collage).toBeHidden();
    await expect(tabBar).toBeVisible();
    await expect(page.locator(".hero__wordmark")).toBeVisible();
  } else {
    await expect(collage).toBeVisible();
    await expect(tabBar).toBeHidden();
    const hero = await page.locator(".hero").boundingBox();
    const panel = await page.locator(".panel").boundingBox();
    expect(panel!.x).toBeGreaterThan(hero!.x + hero!.width - 1);
  }
});

test("on phones the landing fills the first screen and the guide starts below it", async ({
  page,
}) => {
  test.skip(!isPhoneLayout(page), "phone layout only");
  await page.goto("/");
  const viewportHeight = page.viewportSize()!.height;
  const tabBar = await page.getByRole("navigation", { name: "Sections" }).boundingBox();
  const byline = await page.locator(".panel__byline").boundingBox();
  const guide = await page.getByRole("heading", { name: "How to use an ISRC code on Instagram" }).boundingBox();

  // "from The Atom" sits at the bottom of the first screen, just above the tab bar.
  expect(byline!.y + byline!.height).toBeLessThanOrEqual(tabBar!.y);
  expect(byline!.y).toBeGreaterThan(viewportHeight * 0.75);
  // Nothing from the next section is visible until the visitor scrolls.
  expect(guide!.y).toBeGreaterThanOrEqual(tabBar!.y);
});

test("matches the reference field and button metrics", async ({ page }) => {
  await page.goto("/");
  const field = await page.locator(".field").boundingBox();
  const submit = await page.getByRole("button", { name: "Search", exact: true }).boundingBox();
  expect(Math.round(field!.height)).toBe(60);
  expect(Math.round(submit!.height)).toBe(44);

  const radius = await page.locator(".field").evaluate((node) => getComputedStyle(node).borderRadius);
  expect(radius).toBe("16px");
});

test("primary controls are comfortable tap targets and never overlap", async ({
  page,
  mockSearch,
}) => {
  await mockSearch(results([TRACK, LIVE_TRACK]));
  await page.goto("/");
  await searchBox(page).fill("die with a smile");
  const region = page.getByRole("region", { name: "Search results" });
  await expect(region.getByRole("button", { name: "Copy for Instagram" })).toBeVisible();

  const boxes = [];
  for (const control of [
    page.getByRole("button", { name: "Search", exact: true }),
    region.getByRole("button", { name: "Copy for Instagram" }),
    region.getByRole("link", { name: /Open in Spotify/ }),
    region.getByRole("button", { name: "Copy ISRC only" }),
  ]) {
    const box = await control.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    boxes.push(box!);
  }
  for (let index = 1; index < boxes.length; index += 1) {
    expect(boxes[index].y).toBeGreaterThanOrEqual(boxes[index - 1].y + boxes[index - 1].height);
  }
});

test("reserves space for album artwork so results don't shift", async ({ page, mockSearch }) => {
  await mockSearch(results([TRACK]));
  await page.goto("/");
  await searchBox(page).fill("die with a smile");
  const artwork = page.locator(".result__art img").first();
  await expect(artwork).toBeVisible();
  await expect(artwork).toHaveAttribute("width", "48");
  await expect(artwork).toHaveAttribute("height", "48");
  const box = await page.locator(".result__art").first().boundingBox();
  expect([Math.round(box!.width), Math.round(box!.height)]).toEqual([48, 48]);
});

test("long titles wrap instead of being cut off", async ({ page, mockSearch }) => {
  await mockSearch(results([LIVE_TRACK]));
  await page.goto("/");
  await searchBox(page).fill("die with a smile live");
  const title = page.locator(".result__title").first();
  await expect(title).toContainText("deliberately long title to test wrapping");
  const clipped = await title.evaluate((node) => node.scrollWidth > node.clientWidth + 1);
  expect(clipped).toBe(false);
});

test("the search field can be reached and used with the keyboard", async ({ page, mockSearch, browserName }) => {
  test.skip(browserName === "webkit", "WebKit only tabs to links when a system setting is enabled");
  await mockSearch(results([TRACK]));
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  for (let presses = 0; presses < 6; presses += 1) {
    if (await searchBox(page).evaluate((node) => node === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(searchBox(page)).toBeFocused();
  await page.keyboard.type("die with a smile");
  await page.keyboard.press("Enter");
  await expect(page.getByText("isrc:USUM72409273").last()).toBeVisible();
});
