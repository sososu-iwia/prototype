import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const names = {
  kk: {
    home: "Басты бет",
    team: "Команда",
    goals: "Қақпашылар",
    menu: "Мәзір",
    close: "Жабу",
    news: "Жаңалықтар",
  },
  ru: {
    home: "Главная",
    team: "Команда",
    goals: "Вратари",
    menu: "Меню",
    close: "Закрыть",
    news: "Новости",
  },
  en: {
    home: "Home",
    team: "Team",
    goals: "Goalkeepers",
    menu: "Menu",
    close: "Close",
    news: "News",
  },
};
for (const locale of ["kk", "ru", "en"] as const) {
  test(`${locale}: home, navigation, mobile menu, roster filtering and profile`, async ({
    page,
    isMobile,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`/${locale}`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("h1")).toBeVisible();
    if (isMobile) {
      const menu = page.getByRole("button", {
        name: names[locale].menu,
        exact: true,
      });
      await menu.click();
      await expect(menu).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Escape");
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await menu.click();
    }
    await page
      .locator("#navbar")
      .getByRole("link", { name: names[locale].team, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/team$`));
    await page
      .getByRole("button", { name: names[locale].goals, exact: true })
      .click();
    await expect(page.locator(".team-player-card")).toHaveCount(3);
    await page.locator(".team-player-card a").first().focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/${locale}/players/[^/]+$`));
    await expect(page.locator("h1")).not.toBeEmpty();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    expect(errors).toEqual([]);
  });
  test(`${locale}: matches, article, gallery dialog, 404 and admin login state`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/matches`);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("select[name=status]")).toBeVisible();
    await page.goto(`/${locale}/news`);
    await page.locator(".main-news-content :is(h2,h3) a").first().click();
    await expect(page.locator(".article-body")).toBeVisible();
    await page.goto(`/${locale}/gallery`);
    const image = page.locator("button.gallery-item").first();
    await image.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.locator("dialog :focus")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(image).toBeFocused();
    const response = await page.goto(`/${locale}/team/no-such-player`);
    expect(response?.status()).toBe(404);
    await page.goto(`/${locale}/admin`);
    await expect(page.locator("input[name=password]")).toBeVisible();
    await expect(page.locator(".admin-table")).toHaveCount(0);
  });
  test(`${locale}: accessibility on main public pages`, async ({ page }) => {
    for (const route of ["", "/team", "/matches", "/news", "/gallery"]) {
      await page.goto(`/${locale}${route}`);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
    }
  });
}
test("language preference survives root navigation and refresh", async ({
  page,
}) => {
  await page.goto("/kk/players/bekhan-shaizada");
  await page.getByRole("link", { name: "RU", exact: true }).click();
  await expect(page).toHaveURL("/ru/players/bekhan-shaizada");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await page.goto("/");
  await expect(page).toHaveURL("/ru");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
});
test("all old URLs permanently redirect; no full-size legacy images are requested", async ({
  page,
  request,
}) => {
  for (const route of ["index", "about", "team", "matches", "news"]) {
    const r = await request.get(`/${route}.html`, { maxRedirects: 0 });
    expect([301, 308]).toContain(r.status());
  }
  const images: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "image") images.push(r.url());
  });
  await page.goto("/kk/team");
  await page.locator(".team-player-card").last().scrollIntoViewIfNeeded();
  expect(images.some((x) => /\.jpe?g/i.test(x) || x.includes("/images/"))).toBe(
    false,
  );
});
