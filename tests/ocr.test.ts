import test from "node:test";
import assert from "node:assert/strict";

import { MIN_TEXT_LENGTH, ocrIsUsable } from "../src/lib/ocr";

// Shape of a real ML Kit read off a photographed lab report: broken columns,
// stray characters, and values with printed units.
const GOOD = `
COMPLETE BLOOD COUNT
Patient: A. Sharma    Age/Sex: 34/F
Collected: 12 Sep 2026   Reported: 12 Sep 2026

Test                Result    Unit         Reference
Haemoglobin         11.2 g/dL              12.0 - 15.0   L
Total WBC count     7.4 x10^3/uL           4.0 - 11.0
Platelet count      248 x10^3/uL           150 - 410
HbA1c               5.8 %                  4.0 - 5.6     H
Fasting glucose     88 mg/dL               70 - 99
`;

// What a dark, blurred, or off-target photo actually produces: enough
// characters to pass a length check alone, but no measured value anywhere.
const GARBAGE = `
lllll  ......  ~~~~  ffff  llll  iiii  oooo
aaaa  bbbb  cccc  dddd  eeee  gggg  hhhh  jjjj
kkkk  mmmm  nnnn  pppp  qqqq  rrrr  ssss  tttt
uuuu  vvvv  wwww  xxxx  yyyy  zzzz  aaaa  bbbb
`;

test("a real lab read with printed units is usable", () => {
  assert.equal(ocrIsUsable(GOOD), true);
});

test("long text with no measured value is rejected", () => {
  assert.ok(GARBAGE.trim().length > MIN_TEXT_LENGTH, "fixture must clear the length floor");
  assert.equal(ocrIsUsable(GARBAGE), false);
});

test("a short read is rejected even when it contains a value", () => {
  assert.equal(ocrIsUsable("HbA1c 5.8 %"), false);
});

test("empty and whitespace-only reads are rejected", () => {
  assert.equal(ocrIsUsable(""), false);
  assert.equal(ocrIsUsable("   \n\t  "), false);
});
