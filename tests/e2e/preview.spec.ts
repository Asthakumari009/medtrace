import { test, expect } from "@playwright/test";

test("home, documents, report reader, sharing and appearance work on a phone", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.stack ?? e.message));

  await page.goto("/preview");
  await expect(page.locator("#error-overlay")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "All documents, 2" }),
  ).toBeVisible({ timeout: 60000 });
  await page.screenshot({ path: "artifacts/preview-mobile.png" });

  // Home surfaces the two counts and the newest document.
  await expect(page.getByRole("button", { name: "Flagged values, 1" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open Annual health check" }),
  ).toBeVisible();

  // The Documents tile is the route into the list.
  await page.getByRole("button", { name: "All documents, 2" }).click();
  await expect(page.getByText("2 documents", { exact: true })).toBeVisible();

  await page.getByLabel("Search health records", { exact: true }).fill("blood");
  await expect(
    page.getByRole("button", { name: "Open Complete blood count" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open Annual health check" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Clear search" }).click();

  await page.getByRole("button", { name: "Flagged", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open Complete blood count" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Open Annual health check" }).click();

  await expect(page.getByText("Illustrative sample record")).toBeVisible();
  await page.screenshot({ path: "artifacts/report-reader-mobile.png" });
  await page.getByLabel("Search tests in report").fill("Hemoglobin");
  await page
    .getByRole("button", { name: "Details for Hemoglobin", exact: true })
    .click();
  await expect(
    page.getByText("Earlier comparable readings", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/report-history-mobile.png" });
  await page
    .getByRole("button", { name: "Close report reader", exact: true })
    .click();

  // Sharing stays scoped and explicit in the preview.
  await page
    .getByRole("button", { name: "Share records with a doctor", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Preview selected access" }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "Share Annual health check" })
    .click();
  await page.getByRole("radio", { name: "5 minutes", exact: true }).click();
  await page.getByRole("button", { name: "Preview selected access" }).click();
  await expect(
    page.getByText(
      "Preview only. In your account, this creates a single-use QR for exactly the selected reports.",
    ),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/sharing-controls-mobile.png" });
  await page.getByRole("button", { name: "Close sharing controls" }).click();
  await page.screenshot({ path: "artifacts/records-mobile.png" });

  // Ask tab is reachable and grounded copy is present.
  await page.getByRole("tab", { name: "Ask", exact: true }).click();
  await page.getByRole("button", { name: "Was anything flagged?" }).click();
  await expect(
    page.getByText("Preview explanation · no AI request sent"),
  ).toBeVisible();

  await page.getByRole("tab", { name: "You", exact: true }).click();
  await page.getByRole("button", { name: "dark appearance" }).click();
  await page.getByRole("tab", { name: "Home", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "All documents, 2" }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/preview-dark-mobile.png" });

  expect(errors).toEqual([]);
});

test("welcome and wide layouts remain usable", async ({ page }) => {
  await page.goto("/welcome");
  await expect(page.locator("#error-overlay")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Explore the MedTrace preview" }),
  ).toBeVisible({ timeout: 60000 });
  await page.screenshot({ path: "artifacts/welcome-mobile.png" });
  await page
    .getByRole("button", { name: "Explore the MedTrace preview" })
    .click();
  await expect(
    page.getByRole("button", { name: "All documents, 2" }),
  ).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.screenshot({ path: "artifacts/preview-desktop.png" });

  await page.setViewportSize({ width: 320, height: 740 });
  await expect(
    page.getByRole("tab", { name: "Documents", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/preview-small-mobile.png" });
});

test("document search can repeatedly shrink, empty and restore the list", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
  await page.goto("/preview");
  await page.getByRole("tab", { name: "Documents", exact: true }).click();
  const search = page.getByLabel("Search health records", { exact: true });
  for (let pass = 0; pass < 3; pass++) {
    await search.fill("blood");
    await expect(
      page.getByRole("button", { name: "Open Complete blood count" }),
    ).toBeVisible();
    await search.fill("no matching synthetic record");
    await expect(
      page.getByText("No matching documents", { exact: true }),
    ).toBeVisible();
    await search.fill("");
    await expect(
      page.getByRole("button", { name: "Open Annual health check" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Flagged", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Open Complete blood count" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "All", exact: true }).click();
  }
  await page.getByRole("tab", { name: "Home", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "All documents, 2" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
