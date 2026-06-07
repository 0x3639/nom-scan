// Renders the OG/Twitter social cards from og-template.html using the Chromium
// that ships with @playwright/test, at exact social dimensions and 2x for
// crispness, then downscales to the target size with sharp.
//
//   node brand-assets/og/render.mjs
//
// Fonts: injected as @font-face from the local @fontsource/montserrat woff2
// files so rendering needs no network and always uses the brand typeface.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const fontDir = join(repo, "node_modules", "@fontsource", "montserrat", "files");

const fontFace = (weight) => `
  @font-face {
    font-family: "Montserrat";
    font-style: normal;
    font-weight: ${weight};
    src: url("${pathToFileURL(join(fontDir, `montserrat-latin-${weight}-normal.woff2`))}") format("woff2");
  }`;

const html = readFileSync(join(here, "og-template.html"), "utf8").replace(
  "__FONTS__",
  [500, 700, 800].map(fontFace).join("\n"),
);

// Write the resolved HTML to a temp file so file:// font URLs load.
const work = mkdtempSync(join(tmpdir(), "nomscan-og-"));
const htmlPath = join(work, "og.html");
writeFileSync(htmlPath, html);

const targets = [
  { out: join(repo, "public", "og-image.png"), w: 1200, h: 630 },
  { out: join(repo, "public", "twitter-card.png"), w: 1200, h: 628 },
];

const browser = await chromium.launch();
try {
  for (const { out, w, h } of targets) {
    const page = await browser.newPage({
      viewport: { width: w, height: h },
      deviceScaleFactor: 2,
    });
    await page.goto(pathToFileURL(htmlPath).href);
    await page.evaluate(() => document.fonts.ready);
    const shot = await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } });
    await sharp(shot).resize(w, h).png({ compressionLevel: 9 }).toFile(out);
    await page.close();
    console.log(`wrote ${out} (${w}x${h})`);
  }
} finally {
  await browser.close();
}
