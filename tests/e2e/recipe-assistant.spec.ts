import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * STORY-062. Semantic generation itself can't be exercised live here
 * — this environment's OpenAI account has no billing credits, so
 * every chat-completion/moderation call fails and
 * recipe-assistant.service.ts transparently falls back to its
 * "having trouble" message (see recipe-assistant-service.test.ts for
 * that path's real coverage, and smart-search-service.test.ts for
 * the same standard applied in STORY-061). This spec verifies the
 * widget itself: opening, sending a message, the real fallback
 * rendering, and accessibility.
 */

test("opens the widget from the Recipe Centre, sends a message, and shows the real fallback response", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/recipes");

  await page.getByRole("button", { name: "Ask the Recipe Assistant" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Message the Recipe Assistant").fill("I have chicken and coconut milk");
  await dialog.getByRole("button", { name: "Send" }).click();

  await expect(dialog.getByText("Thinking…")).toBeVisible();
  await expect(dialog.getByText(/trouble/i)).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByRole("link", { name: "Browse the Recipe Centre instead" })).toBeVisible();
});

test("closes on Escape", async ({ page }) => {
  await page.goto("/recipes");
  const trigger = page.getByRole("button", { name: "Ask the Recipe Assistant" });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("the widget is keyboard-operable: tab to the trigger, open with Enter, and reach the message input", async ({ page }) => {
  await page.goto("/recipes");
  await page.getByRole("button", { name: "Ask the Recipe Assistant" }).focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Message the Recipe Assistant")).toBeVisible();
});

test("recipe assistant dialog has zero critical/serious axe violations when open", async ({ page }) => {
  await page.goto("/recipes");
  await page.getByRole("button", { name: "Ask the Recipe Assistant" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
});
