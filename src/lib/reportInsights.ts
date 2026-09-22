import type { ObservationRow } from "./database.types";

/** Only plot exact finite readings corroborated by the printed value.
 * Qualifiers, decimal commas and qualitative text remain text, never guesses. */
export function exactNumeric(
  o: Pick<ObservationRow, "value" | "value_numeric">,
): number | null {
  if (o.value_numeric === null || !Number.isFinite(o.value_numeric))
    return null;
  const raw = o.value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)) return null;
  return Number(raw) === o.value_numeric ? o.value_numeric : null;
}
const normalize = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");
export function comparableReadings(
  current: ObservationRow,
  history: ObservationRow[],
): ObservationRow[] {
  if (
    exactNumeric(current) === null ||
    !current.observed_at ||
    !current.unit?.trim()
  )
    return [];
  const byDay = new Map<string, ObservationRow[]>();
  for (const row of history) {
    if (
      row.report_id === current.report_id ||
      !row.observed_at ||
      row.observed_at >= current.observed_at ||
      normalize(row.test_name) !== normalize(current.test_name) ||
      row.unit?.trim() !== current.unit.trim() ||
      normalize(row.category) !== normalize(current.category) ||
      exactNumeric(row) === null
    )
      continue;
    const list = byDay.get(row.observed_at) ?? [];
    list.push(row);
    byDay.set(row.observed_at, list);
  }
  // Ambiguous multiple results on the same date do not establish one trend point.
  return [...byDay.values()]
    .filter((rows) => rows.length === 1)
    .map((rows) => rows[0]!)
    .sort((a, b) => a.observed_at!.localeCompare(b.observed_at!))
    .slice(-5);
}
export function printedRange(
  raw: string | null,
): { low: number; high: number } | null {
  if (!raw) return null;
  const match = raw
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*(?:[-–—]|to)\s*(-?\d+(?:\.\d+)?)$/i);
  if (!match) return null;
  const low = Number(match[1]),
    high = Number(match[2]);
  return Number.isFinite(low) && Number.isFinite(high) && high > low
    ? { low, high }
    : null;
}
export const TEST_GUIDES = [
  {
    names: ["hemoglobin a1c", "hba1c", "a1c", "glycated hemoglobin"],
    body: "HbA1c reflects average blood glucose over roughly the past two to three months. Your care team interprets it with your history and other results.",
    question:
      "What does my HbA1c mean in my situation, and when should it be checked again?",
    url: "https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/",
  },
  {
    names: ["hemoglobin", "haemoglobin", "hb", "hgb"],
    body: "Hemoglobin is the protein in red blood cells that carries oxygen. This result alone cannot tell you why a level has changed.",
    question:
      "How does my hemoglobin fit with the rest of my blood count and any symptoms?",
    url: "https://medlineplus.gov/lab-tests/hemoglobin-test/",
  },
  {
    names: [
      "glucose",
      "blood glucose",
      "fasting glucose",
      "fasting blood glucose",
      "fasting blood sugar",
    ],
    body: "Glucose is a main source of energy for your body. Food, timing, medicines and the type of test affect how a blood glucose result is interpreted.",
    question:
      "Was this glucose test fasting, and does it need follow-up in my situation?",
    url: "https://medlineplus.gov/lab-tests/blood-glucose-test/",
  },
] as const;
export function testGuide(name: string) {
  return TEST_GUIDES.find((g) =>
    (g.names as readonly string[]).includes(normalize(name)),
  );
}
