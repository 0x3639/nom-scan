import { expect, test } from "@playwright/test";

const ADDR = "z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp";
const HASH = "a".repeat(64);
const searchBox = /search by address or hash/i;

test("home shows one search box (nav search is hidden on home)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByPlaceholder(searchBox)).toHaveCount(1);
  await expect(page.getByPlaceholder(searchBox)).toBeVisible();
});

test("search dispatches a z1 address to /address (client-side routing)", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder(searchBox).fill(ADDR);
  await page.getByPlaceholder(searchBox).press("Enter");
  await expect(page).toHaveURL(new RegExp(`/address/${ADDR}`));
});

test("search dispatches a 0x hash to /tx with the prefix stripped and lowercased", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder(searchBox).fill(`0x${HASH.toUpperCase()}`);
  await page.getByPlaceholder(searchBox).press("Enter");
  await expect(page).toHaveURL(new RegExp(`/tx/${HASH}$`));
});

test("address tab state in the URL hash survives a reload", async ({ page }) => {
  await page.goto(`/address/${ADDR}#transactions`);
  await expect(page.getByRole("tab", { name: "Transactions" })).toHaveAttribute("aria-selected", "true");
  await page.reload();
  await expect(page.getByRole("tab", { name: "Transactions" })).toHaveAttribute("aria-selected", "true");
});

test("the browser never talks to the indexer directly (two-tier boundary)", async ({ page }) => {
  const offending: string[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    const benign = url.protocol === "data:" || url.protocol === "blob:";
    if (url.host !== "localhost:5173" && !benign) {
      offending.push(`cross-origin: ${req.method()} ${req.url()}`);
    }
    if (req.headers()["authorization"]) {
      offending.push(`Authorization header on ${req.url()}`);
    }
  });

  await page.goto("/");
  await page.goto(`/address/${ADDR}#portfolios`);
  await page.waitForTimeout(1500); // let /api/* calls fire

  expect(offending, `unexpected outbound browser requests:\n${offending.join("\n")}`).toEqual([]);
});
