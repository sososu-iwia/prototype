import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import * as argon2 from "argon2";
import { db } from "../../apps/api/src/db";
import { assertTestDatabase } from "../helpers/test-database";

test.setTimeout(90000);
test("SUPER_ADMIN creates roles through forms and deactivation revokes an editor session", async ({
  page,
  browser,
}, info) => {
  assertTestDatabase();
  const prefix = `${process.env.E2E_PREFIX}-roles-${info.project.name}`;
  const password = randomUUID() + randomUUID();
  const email = `${prefix}-super@example.invalid`;
  const editorEmail = `${prefix}-editor@example.invalid`;
  const editorContext = await browser.newContext({
    viewport: page.viewportSize(),
  });
  async function login(tab: Page, account: string) {
    await tab.goto("/en/admin");
    await tab.getByLabel("Email", { exact: true }).fill(account);
    await tab.getByLabel("Password", { exact: true }).fill(password);
    await tab.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(tab.locator(".admin-shell")).toBeVisible();
  }
  try {
    await db.user.create({
      data: {
        email,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        role: "SUPER_ADMIN",
      },
    });
    await login(page, email);
    await page
      .locator(".admin-nav")
      .getByRole("button", { name: "Users & roles", exact: true })
      .click();
    for (const role of ["ADMIN", "EDITOR"]) {
      await page
        .getByRole("button", { name: "Create record", exact: true })
        .click();
      await page
        .getByLabel("Email", { exact: true })
        .fill(`${prefix}-${role.toLowerCase()}@example.invalid`);
      await page
        .getByRole("combobox", { name: "Role", exact: true })
        .selectOption(role);
      await page.getByLabel("Password", { exact: false }).fill(password);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.locator(".admin-workspace")).toHaveAttribute(
        "aria-busy",
        "false",
      );
      await expect(page.locator(".admin-table")).toContainText(
        `${prefix}-${role.toLowerCase()}@example.invalid`,
      );
    }
    const editor = await editorContext.newPage();
    await editor.goto(new URL("/en/admin", page.url()).href);
    await editor.getByLabel("Email", { exact: true }).fill(editorEmail);
    await editor.getByLabel("Password", { exact: true }).fill(password);
    await editor.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(editor.locator(".admin-shell")).toBeVisible();
    const csrf = (
      await (
        await editor.request.get(new URL("/api/v1/auth/csrf", page.url()).href)
      ).json()
    ).csrfToken;
    const forbidden = await editor.request.post(
      new URL("/api/v1/admin/players", page.url()).href,
      {
        headers: { Origin: "http://localhost:3000", "X-CSRF-Token": csrf },
        data: {},
      },
    );
    expect(forbidden.status()).toBe(403);
    await page
      .getByRole("textbox", { name: "Search", exact: true })
      .fill(editorEmail);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const row = page.locator(".admin-table tbody tr");
    await expect(row).toHaveCount(1);
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    await page
      .getByRole("checkbox", { name: "Access enabled", exact: true })
      .uncheck();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".admin-workspace")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    expect(
      (
        await editor.request.get(new URL("/api/v1/auth/me", page.url()).href)
      ).status(),
    ).toBe(401);
    await page.reload();
    await expect(page.locator(".admin-shell")).toBeVisible();
    expect(
      await db.user.count({ where: { email: editorEmail, active: false } }),
    ).toBe(1);
  } finally {
    await editorContext.close();
    const users = await db.user.findMany({
      where: { email: { startsWith: prefix } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);
    await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await db.mutationKey.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
});
