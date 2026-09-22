/**
 * On-device text recognition.
 *
 * Google ML Kit runs entirely on the phone — no network, no upload. When a
 * photographed report reads cleanly we send only the extracted text to the
 * API and the image never leaves the device. When the read is poor we fall
 * back to uploading the file, because a half-read lab report is worse than
 * a cloud-read one.
 *
 * ML Kit cannot read PDFs. Those always take the cloud path.
 */

/** Characters below this and the photo was too blurry, dark, or cropped. */
export const MIN_TEXT_LENGTH = 120;

/**
 * Lab reports are numbers with units. Letters alone are what garbage OCR
 * produces, so a usable read must contain at least one measured value.
 *
 * ponytail: these two thresholds are a heuristic, not a model. Retune them
 * against real report photos on the demo device under real lighting; if the
 * fallback fires too often, lower MIN_TEXT_LENGTH before widening the units.
 */
export const UNIT_PATTERN =
  /\d+(?:\.\d+)?\s*(?:mg\/dL|g\/dL|mmol\/L|mEq\/L|mIU\/L|µIU\/mL|uIU\/mL|ng\/mL|pg\/mL|µg\/dL|U\/L|IU\/L|mm\/hr|fL|pg|%|10\^\d|x10\^\d|cells\/µL|\/µL|\/cumm)/i;

/**
 * Is this text good enough to send instead of the image? Both conditions
 * must hold: enough text to be a report, and at least one value with a unit.
 */
export function ocrIsUsable(text: string): boolean {
  const clean = text.trim();
  if (clean.length < MIN_TEXT_LENGTH) return false;
  return UNIT_PATTERN.test(clean);
}

interface TextRecognitionModule {
  recognizeText: (imagePath: string) => Promise<{ text: string }>;
}

let cached: TextRecognitionModule | null | undefined;

/**
 * The ML Kit module calls requireNativeModule() at import time, which throws
 * when the native side isn't in the build (Expo Go, web, a dev client built
 * before this dependency landed). Load it lazily so the app degrades to the
 * cloud path instead of failing to start.
 */
function loadModule(): TextRecognitionModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require("@infinitered/react-native-mlkit-text-recognition") as TextRecognitionModule;
  } catch {
    cached = null;
  }
  return cached;
}

/** True when this build can actually read text on-device. */
export function onDeviceOcrAvailable(): boolean {
  return loadModule() !== null;
}

/**
 * Read an image on this device. Returns the text when it is good enough to
 * replace the upload, or null to tell the caller to take the cloud path.
 */
export async function recognizeOnDevice(uri: string): Promise<string | null> {
  const module = loadModule();
  if (module === null) return null;
  try {
    const result = await module.recognizeText(uri);
    const text = result.text ?? "";
    return ocrIsUsable(text) ? text.trim() : null;
  } catch {
    // A native failure is not a user-facing error — the cloud path still works.
    return null;
  }
}
