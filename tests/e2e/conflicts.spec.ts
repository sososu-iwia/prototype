import { test, expect, type Page } from "@playwright/test";
test.setTimeout(60000);

test("two admin tabs resolve version conflicts without losing either editor's untouched fields", async ({
  page,
}, info) => {
  const prefix = `${process.env.E2E_PREFIX}-conflict-${info.project.name}`;
  await page.goto("/en/admin");
  await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".admin-shell")).toBeVisible();
  const csrf = (await (await page.request.get("/api/v1/auth/csrf")).json())
    .csrfToken;
  const response = await page.request.post("/api/v1/admin/players", {
    headers: { Origin: "http://localhost:3000", "X-CSRF-Token": csrf },
    data: {
      slug: prefix,
      names: { kk: "Сынақ", en: prefix },
      position: "forward",
      status: "DRAFT",
      verification: "LEGACY_UNVERIFIED",
      source: prefix,
      sourceDate: new Date().toISOString(),
      citizenship: "Initial",
      height: 180,
    },
  });
  expect(response.status()).toBe(201);
  const record = await response.json();
  async function edit(tab: Page) {
    await tab
      .locator(".admin-nav")
      .getByRole("button", { name: "Players", exact: true })
      .click();
    await tab
      .getByRole("textbox", { name: "Search", exact: true })
      .fill(prefix);
    await tab.getByRole("button", { name: "Search", exact: true }).click();
    const row = tab.locator(".admin-table tbody tr");
    await expect(row).toHaveCount(1);
    // An assistive tool/user can focus a field as the editor mounts. A later
    // default focus callback must not take that focus (and pending input) away.
    await tab.evaluate(() => {
      const observer = new MutationObserver(() => {
        const input =
          document.querySelector<HTMLInputElement>("#field-citizenship");
        if (input) {
          observer.disconnect();
          input.focus();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    await tab.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    await expect(tab.getByLabel("Citizenship", { exact: true })).toBeFocused();
  }
  await edit(page);
  await page.getByLabel("Citizenship", { exact: true }).fill("Local");
  await expect(page.getByLabel("Citizenship", { exact: true })).toHaveValue(
    "Local",
  );
  const other = await page.context().newPage();
  await other.goto("/en/admin");
  await edit(other);
  await other.getByLabel("Citizenship", { exact: true }).fill("Remote");
  await other.getByLabel("Height (cm)", { exact: true }).fill("190");
  await other.getByRole("button", { name: "Save", exact: true }).click();
  await expect(other.locator(".admin-table")).toBeVisible();
  await other.close();
  const failed = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/admin/players/${record.id}`) &&
      r.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect((await failed).status()).toBe(409);
  await expect(page.getByLabel("Citizenship", { exact: true })).toHaveValue(
    "Local",
  );
  const refresh = page.getByRole("button", {
    name: "Refresh version and keep edits",
    exact: true,
  });
  await refresh.click();
  await expect(page.getByRole("dialog")).toContainText("Citizenship");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(page.getByLabel("Citizenship", { exact: true })).toHaveValue(
    "Local",
  );
  await refresh.click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(page.getByLabel("Citizenship", { exact: true })).toHaveValue(
    "Local",
  );
  await expect(page.getByLabel("Height (cm)", { exact: true })).toHaveValue(
    "190",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".admin-table")).toBeVisible();
  const stored = await (
    await page.request.get(`/api/v1/admin/players/${record.id}`)
  ).json();
  expect(stored.citizenship).toBe("Local");
  expect(stored.height).toBe(190);
  await page.reload();
  await edit(page);
  await expect(page.getByLabel("Citizenship", { exact: true })).toHaveValue(
    "Local",
  );
  await expect(page.getByLabel("Height (cm)", { exact: true })).toHaveValue(
    "190",
  );
});
