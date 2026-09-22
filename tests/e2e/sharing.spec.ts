import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

async function doctor(page: Page) {
  const state = { revoked: false, stall: false, sessions: 0, delay: 0 };
  await page.route("http://vita-sharing.test/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const headers = {
      "cache-control": "no-store",
      "Content-Security-Policy":
        "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    };
    if (
      path.startsWith("/doctor-assets/") ||
      route.request().method() === "GET"
    ) {
      const file = path.startsWith("/doctor-assets/")
        ? path.split("/").pop()!
        : "index.html";
      await route.fulfill({
        status: 200,
        headers,
        contentType: file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : "text/html",
        body: readFileSync(resolve("doctor-web", file)),
      });
      return;
    }
    if (path === "/share/redeem") {
      await route.fulfill({
        json: {
          share_id: "synthetic",
          viewer_token: "synthetic-viewer-credential",
          expires_at: "2099-01-01T00:00:00Z",
        },
      });
      return;
    }
    if (path === "/share/session") {
      state.sessions++;
      const revokedAtRead = state.revoked;
      if (state.stall) {
        await new Promise((r) => setTimeout(r, 1200));
        await route.abort().catch(() => {});
        return;
      }
      if (state.delay) await new Promise((r) => setTimeout(r, state.delay));
      await route
        .fulfill(
          revokedAtRead
            ? { status: 410, json: { detail: "revoked" } }
            : { json: { active: true, lease_ms: 900 } },
        )
        .catch(() => {});
      return;
    }
    if (path === "/share/records") {
      await route.fulfill(
        state.revoked
          ? { status: 410, json: { detail: "revoked" } }
          : {
              json: {
                patient_name: "Synthetic Patient",
                recipient_label: "Test visit",
                reports: [
                  {
                    title: "Synthetic health check",
                    report_date: "2026-09-01",
                    observations: [
                      {
                        test_name: "Synthetic marker",
                        value: "14.2",
                        unit: "g/dL",
                        reference_range: "12–16",
                        flagged: false,
                      },
                    ],
                  },
                ],
              },
            },
      );
      return;
    }
    await route.abort();
  });
  await page.goto("http://vita-sharing.test/share/open#synthetic-one-time-code");
  await page.getByRole("button", { name: "Open shared records" }).click();
  await expect(page.locator("#patient")).toHaveText("Synthetic Patient");
  await expect(page.locator("#records")).toBeVisible();
  return state;
}

test("an already-open doctor view clears within one second of revocation", async ({
  page,
}) => {
  const state = await doctor(page);
  await page.screenshot({ path: "artifacts/doctor-view-mobile.png" });
  expect(new URL(page.url()).pathname).toBe("/share/view");
  const start = Date.now();
  state.revoked = true;
  await expect(page.locator("#reports")).toBeEmpty({ timeout: 1100 });
  expect(Date.now() - start).toBeLessThan(1100);
  await expect(page.locator("#patient")).toBeEmpty();
  await expect(page.getByText("This view is locked.")).toBeVisible();
  await expect(page.getByText("Synthetic marker")).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
  ).toBe(0);
  await page.screenshot({ path: "artifacts/doctor-revoked-mobile.png" });
});
test("network loss expires the display lease and removes medical text", async ({
  page,
}) => {
  const state = await doctor(page);
  state.stall = true;
  await expect(page.locator("#reports")).toBeEmpty({ timeout: 1200 });
  await expect(page.locator("#patient")).toBeEmpty();
});
test("a delayed pre-revocation response cannot restore cleared records", async ({
  page,
}) => {
  const state = await doctor(page);
  state.delay = 1100;
  await expect.poll(() => state.sessions).toBeGreaterThan(1);
  state.revoked = true;
  await expect(page.locator("#reports")).toBeEmpty({ timeout: 1200 });
  await page.waitForTimeout(1300);
  await expect(page.locator("#reports")).toBeEmpty();
  await expect(page.locator("#records")).toBeHidden();
});
test("leaving the page clears records and resume requires fresh permission", async ({
  page,
}) => {
  const state = await doctor(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("#reports")).toBeEmpty();
  state.revoked = true;
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.getByRole("button", { name: "Verify access and resume" }).click();
  await expect(page.getByText("This view is locked.")).toBeVisible();
  await expect(page.locator("#reports")).toBeEmpty();
});
