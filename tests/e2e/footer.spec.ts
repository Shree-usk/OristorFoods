import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("footer renders on the homepage with all four link columns", async ({ page }) => {
  await page.goto("/");
  const footer = page.locator("footer");
  await expect(footer).toBeVisible();

  for (const heading of ["Shop", "Learn", "Company", "Account"]) {
    await expect(footer.getByText(heading, { exact: true })).toBeVisible();
  }
  // A link present only in the footer IA (not the header nav) per the AC.
  await expect(footer.getByRole("link", { name: "Sustainability" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Referral Programme" })).toBeVisible();
});

test("newsletter form shows an inline validation error for a malformed email", async ({ page }) => {
  await page.goto("/");
  const footer = page.locator("footer");
  await footer.getByLabel(/inbox/i).fill("not-an-email");
  await footer.getByRole("button", { name: "Subscribe" }).click();

  await expect(footer.getByRole("alert")).toContainText(/valid email/i);
});

test("newsletter form succeeds for a valid email without a page reload", async ({ page }) => {
  await page.goto("/");
  const footer = page.locator("footer");
  await footer.getByLabel(/inbox/i).fill("expat@example.com");
  await footer.getByRole("button", { name: "Subscribe" }).click();

  await expect(footer.getByRole("status")).toContainText(/subscribed/i);
  await expect(page).toHaveURL("/"); // no navigation/reload occurred
});

test("social links open in a new tab with rel=noopener noreferrer", async ({ page }) => {
  await page.goto("/");
  const footer = page.locator("footer");

  for (const label of ["Facebook", "Instagram", "YouTube"]) {
    const link = footer.getByRole("link", { name: label });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(link).toHaveAttribute("href", /^https:\/\//);
  }
});

test("footer has zero critical/serious axe violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).include("footer").analyze();
  const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
});
