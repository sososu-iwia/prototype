import { test, expect } from "@playwright/test";
test("API outage serves a labeled public archive and safe empty match state", async ({
  page,
}) => {
  await page.goto("http://localhost:3001/en/team");
  await expect(
    page.getByText("The server is unavailable. Showing an archived snapshot.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".team-player-card")).toHaveCount(20);
  await page.goto("http://localhost:3001/en/matches");
  await expect(page.getByText("No published data yet.").first()).toBeVisible();
});
