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
      await expect(page.getByRole("region", { name: "Search results" }).getByText("isrc:USUM72409273")).toBeVisible();
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
  await expect(page.getByRole("region", { name: "Search results" }).getByText("isrc:USUM72409273")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("uses the two-column reference layout on desktop and the stacked one on phones", async ({
  page,
}) => {
  await page.goto("/");
  const collage = page.locator(".demo--hero");
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

test("on desktop the hero fills the first screen and the guide starts below it", async ({
  page,
}) => {
  test.skip(isPhoneLayout(page), "desktop layout only");
  await page.goto("/");
  const viewportHeight = page.viewportSize()!.height;
  const split = await page.locator(".split").boundingBox();
  const guide = await page.getByRole("heading", { name: "How to use an ISRC code on Instagram" }).boundingBox();
  expect(Math.round(split!.height)).toBeGreaterThanOrEqual(viewportHeight);
  expect(guide!.y).toBeGreaterThanOrEqual(viewportHeight);
  // The search form sits in the vertical middle of the panel.
  const first = await page.locator(".panel__heading").boundingBox();
  const last = await page.locator(".panel__byline").boundingBox();
  const above = first!.y;
  const below = viewportHeight - (last!.y + last!.height);
  expect(Math.abs(above - below)).toBeLessThanOrEqual(16);
  // The dividing rule under the hero is not visible until the visitor scrolls.
  const rule = await page.locator("main > .rule").first().boundingBox();
  expect(rule!.y).toBeGreaterThanOrEqual(viewportHeight);
});

test("on desktop the logo stays with the hero while the results scroll", async ({ page, mockSearch }) => {
  test.skip(isPhoneLayout(page), "desktop layout only");
  const many = Array.from({ length: 10 }, (_, index) => ({ ...TRACK, id: `spotify:track-${index}`, title: `Song ${index}` }));
  await mockSearch(results(many));
  await page.goto("/");
  await searchBox(page).fill("song");
  await expect(page.getByText("Song 9")).toBeVisible();

  const logo = page.getByRole("link", { name: "Instagram Song Finder home" });
  const illustration = page.locator(".demo--hero");
  const before = { logo: await logo.boundingBox(), art: await illustration.boundingBox() };
  await page.mouse.wheel(0, 300);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  const after = { logo: await logo.boundingBox(), art: await illustration.boundingBox() };

  // Both stay pinned in the viewport instead of scrolling away.
  expect(Math.round(after.logo!.y)).toBe(Math.round(before.logo!.y));
  expect(Math.round(after.art!.y)).toBe(Math.round(before.art!.y));
});

test("on phones the site name and the pill share a top bar without touching", async ({ page }) => {
  test.skip(!isPhoneLayout(page), "phone layout only");
  await page.goto("/");
  const name = await page.locator(".hero__wordmark").boundingBox();
  const pill = await page.locator(".top-action").boundingBox();
  const headline = await page.locator(".hero__headline").boundingBox();

  // Left and right of the same row.
  expect(name!.x).toBeLessThan(40);
  expect(Math.abs(name!.y + name!.height / 2 - (pill!.y + pill!.height / 2))).toBeLessThanOrEqual(4);
  expect(name!.x + name!.width).toBeLessThan(pill!.x - 4);
  // The headline starts below the bar.
  expect(headline!.y).toBeGreaterThan(name!.y + name!.height);
});

test("on phones the landing is at least one screen tall and the guide starts below it", async ({
  page,
}) => {
  test.skip(!isPhoneLayout(page), "phone layout only");
  await page.goto("/");
  const viewportHeight = page.viewportSize()!.height;
  const tabBar = await page.getByRole("navigation", { name: "Sections" }).boundingBox();
  const landing = await page.locator(".split").boundingBox();
  const demo = await page.locator(".demo--panel").boundingBox();
  const search = await page.getByRole("button", { name: "Search", exact: true }).boundingBox();
  const guide = await page.getByRole("heading", { name: "How to use an ISRC code on Instagram" }).boundingBox();

  expect(Math.ceil(landing!.height)).toBeGreaterThanOrEqual(viewportHeight - Math.round(tabBar!.height));
  // The demo starts right under the search button, so it is in view without scrolling.
  expect(demo!.y).toBeGreaterThan(search!.y + search!.height);
  expect(demo!.y).toBeLessThan(tabBar!.y);
  // Nothing from the next section shows until the visitor scrolls past the landing.
  expect(guide!.y).toBeGreaterThanOrEqual(tabBar!.y);
});

test("the demo plays silently by itself and offers the browser's own player controls", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const demo = page.locator(isPhoneLayout(page) ? ".demo--panel" : ".demo--hero");
  const video = demo.locator("video");
  await expect(demo).toBeVisible();
  await demo.scrollIntoViewIfNeeded();

  await expect(video).toHaveAttribute("poster", "/demo-poster.webp");
  await expect(video).toHaveAttribute("playsinline", "");
  await expect(video).toHaveAttribute("loop", "");
  // The native player, so visitors can pause, scrub and turn the sound on.
  await expect(video).toHaveAttribute("controls", "");
  expect(await video.evaluate((node: HTMLVideoElement) => node.muted)).toBe(true);

  // It plays by itself once in view.
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => !node.paused), { timeout: 15_000 }).toBe(true);

  // One press turns the music on, and the button gets out of the way.
  const sound = demo.getByRole("button", { name: "Tap for sound" });
  await expect(sound).toBeVisible();
  await sound.click();
  expect(await video.evaluate((node: HTMLVideoElement) => node.muted)).toBe(false);
  await expect(sound).toHaveCount(0);
  // Muting from the player's own controls brings it back.
  await video.evaluate((node: HTMLVideoElement) => {
    node.muted = true;
  });
  await expect(sound).toBeVisible();

  // Scrubbing works: jumping ahead moves the playhead.
  await video.evaluate((node: HTMLVideoElement) => {
    node.currentTime = 12;
  });
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThanOrEqual(12);

  // The screen keeps the recording's proportions, so nothing is cropped.
  const screen = await demo.boundingBox();
  expect(screen!.width / screen!.height).toBeCloseTo(588 / 1280, 1);

  const file = await request.get("/demo.mp4");
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toContain("video/mp4");
  // Small enough not to hold the page up on a phone connection.
  expect(Number(file.headers()["content-length"])).toBeLessThan(4_000_000);
});

test("on phones the demo makes way for search results", async ({ page, mockSearch }) => {
  test.skip(!isPhoneLayout(page), "phone layout only");
  await mockSearch(results([TRACK]));
  await page.goto("/");
  await expect(page.locator(".demo--panel")).toBeVisible();
  await searchBox(page).fill("die with a smile");
  await expect(page.getByRole("region", { name: "Search results" })).toBeVisible();
  await expect(page.locator(".demo--panel")).toHaveCount(0);
});

test("the tab bar highlights the tab for what is on screen", async ({ page }) => {
  test.skip(!isPhoneLayout(page), "phone layout only");
  await page.goto("/");
  const tabBar = page.getByRole("navigation", { name: "Sections" });
  const tab = (name: string) => tabBar.getByRole(name === "Search for a song" ? "button" : "link", { name });
  const activeTabs = () =>
    tabBar.locator("[aria-current]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")));

  await expect.poll(activeTabs).toEqual(["Home"]);

  await tab("How it works").click();
  await expect.poll(activeTabs).toEqual(["How it works"]);

  await tab("Frequently asked questions").click();
  await expect.poll(activeTabs).toEqual(["Frequently asked questions"]);

  await tab("Search for a song").click();
  await expect(searchBox(page)).toBeFocused();
  await expect.poll(activeTabs).toEqual(["Search for a song"]);

  await searchBox(page).blur();
  await tab("Home").click();
  await expect.poll(activeTabs).toEqual(["Home"]);

  await tab("About").click();
  await expect(page).toHaveURL(/\/about$/);
  await expect.poll(activeTabs).toEqual(["About"]);
});

test("the top-right pill links to GitHub, then becomes Try now past the hero", async ({ page }) => {
  await page.goto("/");
  const star = page.getByRole("link", { name: "Star on GitHub" });
  await expect(star).toBeVisible();
  await expect(star).toHaveAttribute("href", "https://github.com/zakisheriff/Instagram-Song-Finder");
  await expect(page.getByRole("button", { name: "Try now" })).toHaveCount(0);

  await page.locator("#faq").scrollIntoViewIfNeeded();
  const tryNow = page.getByRole("button", { name: "Try now" });
  await expect(tryNow).toBeVisible();
  await expect(star).toHaveCount(0);

  await tryNow.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
  await expect(searchBox(page)).toBeFocused();
  await expect(star).toBeVisible();
});

test("the feedback links and the byline sit clear of the demo phone", async ({ page }) => {
  await page.goto("/");
  const phone = await page.locator(isPhoneLayout(page) ? ".demo--panel" : ".demo--hero").boundingBox();
  const links = await page
    .locator(isPhoneLayout(page) ? ".panel__feedback" : ".hero__feedback")
    .boundingBox();
  // Allow for the bezel drawn around the screen.
  expect(links!.y).toBeGreaterThanOrEqual(phone!.y + phone!.height + 10);

  const byline = page.locator(".panel__byline");
  await expect(byline).toHaveText(/^by\s*The Atom$/);
  // One line of text, not two.
  expect((await byline.boundingBox())!.height).toBeLessThan(26);
});

test("bug reports and missing-song reports open an email to The Atom", async ({ page }) => {
  await page.goto("/");
  // Shown on the first screen and again under the FAQ.
  const bug = page.getByRole("link", { name: "Report a bug" }).filter({ visible: true }).first();
  const feature = page.getByRole("link", { name: "Missing a song? Tell us" }).filter({ visible: true }).first();
  await expect(page.getByRole("link", { name: "Report a bug" }).filter({ visible: true })).toHaveCount(2);
  await expect(bug).toHaveAttribute("href", /^mailto:info@theatom\.lk\?subject=Bug%20report/);
  await expect(feature).toHaveAttribute("href", /^mailto:info@theatom\.lk\?subject=Missing%20song/);
});

test("every home page section is at least one screen tall", async ({ page }) => {
  await page.goto("/");
  const viewportHeight = page.viewportSize()!.height;
  const tabBar = isPhoneLayout(page) ? 45 : 0;
  for (const id of ["how-it-works", "supported-links", "faq", "about"]) {
    const box = await page.locator(`#${id}`).boundingBox();
    expect(Math.ceil(box!.height), id).toBeGreaterThanOrEqual(viewportHeight - tabBar);
  }
});

test("FAQ answers stay closed until their question is opened", async ({ page }) => {
  await page.goto("/");
  const answer = page.getByText("ISRC codes are unique to recordings, not to songs.", { exact: false });
  await expect(answer).toBeHidden();

  await page.getByRole("button", { name: "Are ISRC codes unique to songs?" }).click();
  await expect(answer).toBeVisible();

  // Opening another question closes the first.
  await page.getByRole("button", { name: "What is an ISRC?" }).click();
  await expect(page.getByText("International Standard Recording Code", { exact: false }).first()).toBeVisible();
  await expect(answer).toBeHidden();
});

test("a link to a question opens it", async ({ page }) => {
  await page.goto("/#what-is-an-isrc");
  await expect(page.getByRole("button", { name: "What is an ISRC?" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("defined by the ISO 3901 standard", { exact: false })).toBeVisible();
});

test("tapping controls never shows the default grey tap box", async ({ page }) => {
  await page.goto("/");
  const colours = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a, button, input, label, .field")).map(
      (node) => getComputedStyle(node).getPropertyValue("-webkit-tap-highlight-color"),
    ),
  );
  expect(colours.length).toBeGreaterThan(5);
  for (const colour of colours) {
    // Browsers without the property report an empty string.
    expect(["", "rgba(0, 0, 0, 0)", "transparent"]).toContain(colour);
  }
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
    region.getByRole("link", { name: "Copy and open Instagram" }),
    region.getByRole("link", { name: /Open in Spotify/ }),
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
  await expect(page.getByRole("region", { name: "Search results" }).getByText("isrc:USUM72409273")).toBeVisible();
});
