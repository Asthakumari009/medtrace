import { test, expect } from "@playwright/test";

const sizes = [
  { name: "compact phone", width: 320, height: 568 },
  { name: "Android phone", width: 360, height: 800 },
  { name: "large phone", width: 430, height: 932 },
  { name: "phone landscape", width: 844, height: 390 },
  { name: "small tablet", width: 768, height: 1024 },
  { name: "tablet landscape", width: 1180, height: 820 },
];

for (const size of sizes)
  test(`${size.name}: documents, sheets and text input stay reachable`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto("/preview");
    await expect(
      page.getByRole("tab", { name: "Documents", exact: true }),
    ).toBeVisible({ timeout: 60000 });

    await page.getByRole("tab", { name: "Documents", exact: true }).click();
    await page
      .getByRole("button", { name: "Share records with a doctor", exact: true })
      .first()
      .click();
    await page.getByLabel("Recipient label").fill("My next appointment");
    await page
      .getByRole("checkbox", { name: "Share Annual health check" })
      .click();
    await page.getByRole("button", { name: "Preview selected access" }).click();
    await page.getByRole("button", { name: "Close sharing controls" }).click();

    await page
      .getByRole("button", { name: "Open Annual health check", exact: true })
      .click();
    await page.getByLabel("Search tests in report").fill("HbA1c");
    await page
      .getByRole("button", { name: "Details for HbA1c", exact: true })
      .click();
    await page.getByRole("button", { name: "Close report reader" }).click();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
