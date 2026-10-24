import { test, expect } from "@playwright/test";
test.setTimeout(90000);

test("all admin modules and form controls fit the viewport and remain reachable", async ({
  page,
}) => {
  await page.goto("/en/admin");
  await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".admin-shell")).toBeVisible();
  await expect(page.locator("#header")).toHaveCSS("position", "static");
  const navigation = page.locator(".admin-nav");
  const names = await navigation.getByRole("button").allTextContents();
  for (const name of names) {
    const button = navigation.getByRole("button", { name, exact: true });
    await expect(button).toBeEnabled();
    await button.click();
    await expect(page.locator(".admin-section-title")).toHaveText(name);
    await expect(page.locator(".admin-workspace")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(page.locator(".admin-message")).toHaveText("");
    const create = page.getByRole("button", {
      name: "Create record",
      exact: true,
    });
    if (await create.isVisible()) {
      await create.click();
      await expect(page.locator(".admin-form")).toBeVisible();
      await expect(page.locator(".admin-message")).toHaveText("");
      const save = page.getByRole("button", { name: "Save", exact: true });
      // begin() focuses the first field on the next frame. Let that finish,
      // then verify the Save button is reachable through the real tab order.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          ),
      );
      await save.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(save).toBeFocused();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      name,
    ).toBeTruthy();
  }
});
