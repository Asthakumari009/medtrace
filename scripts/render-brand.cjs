/**
 * Renders every app icon and the README banner from one mark.
 *   node scripts/render-brand.cjs
 *
 * The mark: a vital-sign trace whose QRS spike reads as an "M", ending in a
 * single point, the record being traced. One lime stroke on the near-black
 * canvas, same as the app (src/ui/theme.ts: dark accent #D8FF3E, canvas #0A0B0A).
 */
const { chromium } = require("@playwright/test");
const { readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { resolve } = require("node:path");

const LIME = "#D8FF3E";
const CANVAS = "#0A0B0A";

// Drawn on a 1024 grid, optically centred (the valley's weight sits low).
const trace = (color, scale = 1) => `
  <g transform="translate(512 512) scale(${scale}) translate(-512 -498)">
    <path d="M168 572 H310 L416 318 L512 648 L608 318 L714 572 H742"
      fill="none" stroke="${color}" stroke-width="68"
      stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="850" cy="572" r="44" fill="${color}"/>
  </g>`;

const svg = (body, { size = 1024, w = size, h = size } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

const tile = (radius, fill = CANVAS, scale = 0.8) =>
  `<rect width="1024" height="1024" rx="${radius}" fill="${fill}"/>${trace(LIME, scale)}`;

const font = (weight) =>
  readFileSync(
    resolve(`node_modules/@expo-google-fonts/geist/${weight}/Geist_${weight}.ttf`),
  ).toString("base64");

const banner = svg(
  `<defs><style>
     @font-face{font-family:G;font-weight:600;src:url(data:font/ttf;base64,${font("600SemiBold")})}
     @font-face{font-family:G;font-weight:400;src:url(data:font/ttf;base64,${font("400Regular")})}
   </style></defs>
   <rect width="1600" height="560" fill="${CANVAS}"/>
   <g transform="translate(150 150) scale(0.254)">${tile(232, "#171917")}</g>
   <text x="460" y="286" font-family="G" font-weight="600" font-size="128" letter-spacing="-5" fill="#F5F7F2">MedTrace</text>
   <text x="466" y="360" font-family="G" font-weight="400" font-size="36" letter-spacing="-0.5" fill="rgba(245,247,242,0.6)">Your medical history, read, organised and shared on your terms.</text>
   <rect x="466" y="404" width="72" height="6" rx="3" fill="${LIME}"/>`,
  { w: 1600, h: 560 },
);

const outputs = [
  // iOS masks its own corners; the store icon must be full bleed.
  ["assets/icon.png", svg(tile(0, CANVAS, 0.86)), 1024],
  // Android adaptive: the launcher masks to a ~66dp circle of 108dp. Keep the
  // mark inside it.
  ["assets/android-icon-foreground.png", svg(trace(LIME, 0.58)), 1024],
  ["assets/android-icon-background.png", svg(`<rect width="1024" height="1024" fill="${CANVAS}"/>`), 1024],
  ["assets/android-icon-monochrome.png", svg(trace("#FFFFFF", 0.58)), 1024],
  // Splash sits on bone (light) and near-black (dark); the whole tile reads on both.
  ["assets/splash-icon.png", svg(tile(232)), 1024],
  ["assets/favicon.png", svg(tile(232)), 48],
  ["assets/brand/banner.png", banner, [1600, 560]],
];

(async () => {
  mkdirSync("assets/brand", { recursive: true });
  writeFileSync("assets/brand/mark.svg", svg(trace(LIME)));
  writeFileSync("assets/brand/icon.svg", svg(tile(232)));
  const browser = await chromium.launch();
  for (const [file, source, size] of outputs) {
    const [w, h] = Array.isArray(size) ? size : [size, size];
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const scaled = source.replace(/width="(\d+)" height="(\d+)"/, `width="${w}" height="${h}"`);
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${scaled}</body></html>`,
    );
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: file, omitBackground: true });
    await page.close();
    console.log("wrote", file);
  }
  await browser.close();
})();
