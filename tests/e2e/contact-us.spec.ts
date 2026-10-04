import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { prisma } from "@/lib/db";

/** STORY-072. Serial mode: this spec's DB writes under fullyParallel otherwise contend for PGlite's single-connection local dev instance (see other admin e2e specs this session for the same precaution). */

const EMAIL_DOMAIN = "@e2e-contact-us.test";
let sequence = 0;

test.describe("Contact Us (STORY-072)", () => {
  test.describe.configure({ mode: "serial" });

  test.afterEach(async () => {
    await prisma.contactEnquiry.deleteMany({ where: { contactEmail: { endsWith: EMAIL_DOMAIN } } });
    await prisma.exportEnquiry.deleteMany({ where: { contactEmail: { endsWith: EMAIL_DOMAIN } } });
  });

  test("renders the hero, real contact info, and the form", async ({ page }) => {
    await page.goto("/contact-us");

    await expect(page.getByRole("heading", { name: "Let's talk about good food." })).toBeVisible();
    await expect(page.locator("main").getByText("Oristor Food Products (Pvt) Ltd")).toBeVisible();
    await expect(page.getByLabel("Hi, I'm")).toBeVisible();
  });

  /**
   * Regression: nav-config.ts/footer-config.ts both pre-dated this story
   * and already pointed their "Contact" link at `/contact` — a 404,
   * never cross-checked during the original implementation (only the
   * brief's own "Target: /contact-us" was followed). Confirmed and fixed
   * directly with the user; this test pins the real, live header/footer
   * links to the real page so this can't silently regress.
   */
  test("the header and footer Contact links resolve to the real page, not a 404", async ({ page }) => {
    await page.goto("/");
    await page.locator("header").getByRole("link", { name: "Contact" }).click();
    await expect(page).toHaveURL(/\/contact-us$/);
    await expect(page.getByRole("heading", { name: "Let's talk about good food." })).toBeVisible();

    await page.goto("/");
    await expect(page.locator("footer").getByRole("link", { name: "Contact", exact: true })).toHaveAttribute("href", "/contact-us");
  });

  test("selecting Wholesale reveals the business fields, selecting General hides them again", async ({ page }) => {
    await page.goto("/contact-us");

    await expect(page.getByLabel("Company name")).not.toBeVisible();

    await page.getByRole("combobox", { name: /contacting ORISTOR about/i }).click();
    await page.getByRole("option", { name: "Wholesale" }).click();
    await expect(page.getByLabel("Company name")).toBeVisible();
    await expect(page.getByLabel("Country")).toBeVisible();

    await page.getByRole("combobox", { name: /contacting ORISTOR about/i }).click();
    await page.getByRole("option", { name: "General Enquiry" }).click();
    await expect(page.getByLabel("Company name")).not.toBeVisible();
  });

  test("an Export enquiry submission lands in ExportEnquiry, not ContactEnquiry", async ({ page }) => {
    sequence += 1;
    const email = `export-${sequence}${EMAIL_DOMAIN}`;

    await page.goto("/contact-us");
    await page.getByLabel("Hi, I'm").fill("Export Buyer");
    await page.getByRole("combobox", { name: /contacting ORISTOR about/i }).click();
    await page.getByRole("option", { name: "Export / International Business" }).click();
    await page.getByLabel("My email is").fill(email);
    await page.getByLabel("Company name").fill("Global Foods Ltd");
    await page.getByLabel("Country").fill("Germany");
    await page.getByLabel("Tell us a little more").fill("Interested in a bulk spice order.");
    await page.getByRole("button", { name: "Send enquiry" }).click();

    await expect(page.getByText("Thank you for reaching out.")).toBeVisible({ timeout: 15_000 });

    const exportRow = await prisma.exportEnquiry.findFirst({ where: { contactEmail: email } });
    expect(exportRow).not.toBeNull();
    const contactRow = await prisma.contactEnquiry.findFirst({ where: { contactEmail: email } });
    expect(contactRow).toBeNull();
  });

  test("a filled honeypot still shows the normal success state", async ({ page }) => {
    sequence += 1;
    const email = `honeypot-${sequence}${EMAIL_DOMAIN}`;

    await page.goto("/contact-us");
    await page.getByLabel("Hi, I'm").fill("Bot Submitter");
    await page.getByLabel("My email is").fill(email);
    await page.getByLabel("Tell us a little more").fill("Automated message.");
    await page.locator('input[name="honeypot"]').fill("i-am-a-bot");
    await page.getByRole("button", { name: "Send enquiry" }).click();

    await expect(page.getByText("Thank you for reaching out.")).toBeVisible({ timeout: 15_000 });

    const stored = await prisma.contactEnquiry.findFirst({ where: { contactEmail: email } });
    expect(stored).toBeNull();
  });

  test("the form is keyboard-operable end to end", async ({ page }) => {
    sequence += 1;
    const email = `keyboard-${sequence}${EMAIL_DOMAIN}`;

    await page.goto("/contact-us");
    await page.getByLabel("Hi, I'm").focus();
    await page.keyboard.type("Keyboard User");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.getByLabel("My email is").fill(email);
    await page.getByLabel("Tell us a little more").fill("Submitted via keyboard only.");
    await page.getByRole("button", { name: "Send enquiry" }).click();

    await expect(page.getByText("Thank you for reaching out.")).toBeVisible({ timeout: 15_000 });
  });

  test("contact page has zero critical/serious axe violations", async ({ page }) => {
    await page.goto("/contact-us");

    const results = await new AxeBuilder({ page }).analyze();
    const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
  });
});
