import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * STORY-063. Real chat-completion/moderation calls can't be exercised
 * live here — this environment's OpenAI account has no billing
 * credits, so every call fails and support-assistant.service.ts
 * transparently falls back to its "having trouble" message (see
 * support-assistant-service.test.ts for the requiresSignIn/
 * cross-customer-isolation/guardrail coverage, which needs a fake
 * provider Playwright can't inject). This spec verifies the launcher
 * is sitewide and the widget itself works end to end.
 */

test("the launcher is visible sitewide, on both the homepage and a product-area page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Support" })).toBeVisible();

  await page.goto("/recipes");
  await expect(page.getByRole("button", { name: "Support" })).toBeVisible();
});

test("opens the widget, sends a message, and shows the real fallback response", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");

  await page.getByRole("button", { name: "Support" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Message the Support Assistant").fill("What's the status of my order?");
  await dialog.getByRole("button", { name: "Send", exact: true }).click();

  await expect(dialog.getByText("Thinking…")).toBeVisible();
  await expect(dialog.getByText(/trouble/i)).toBeVisible({ timeout: 30_000 });
});

test("the Talk to a human button is always visible in the widget header", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Support" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Talk to a human" })).toBeVisible();
});

test("closes on Escape", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Support" });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("the widget is keyboard-operable: tab to the trigger, open with Enter, and reach the message input", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Support" }).focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Message the Support Assistant")).toBeVisible();
});

test("support assistant dialog has zero critical/serious axe violations when open", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Support" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
});
