import test from "node:test";
import assert from "node:assert/strict";
import {
  comparableReadings,
  exactNumeric,
  printedRange,
} from "../src/lib/reportInsights";
import type { ObservationRow } from "../src/lib/database.types";
const observation = (patch: Partial<ObservationRow> = {}): ObservationRow => ({
  id: "current",
  report_id: "current",
  user_id: "test",
  test_name: "Hemoglobin",
  value: "14",
  value_numeric: 14,
  unit: "g/dL",
  reference_range: "12–16",
  category: "Blood count",
  observed_at: "2026-09-20",
  created_at: "2026-09-20",
  flagged: false,
  ...patch,
});
test("only exact corroborated numeric values are plotted", () => {
  assert.equal(exactNumeric(observation()), 14);
  for (const value of ["<14", ">14", "14 mg", "1,4", "1,400", "Negative", ""])
    assert.equal(exactNumeric(observation({ value })), null);
  assert.equal(exactNumeric(observation({ value: "15" })), null);
  assert.equal(
    exactNumeric(observation({ value: "Infinity", value_numeric: Infinity })),
    null,
  );
});
test("comparisons reject different units, categories, missing dates, same-date ambiguity and future values", () => {
  const previous = observation({
    id: "previous",
    report_id: "previous",
    observed_at: "2026-08-20",
  });
  const invalid = [
    { ...previous, unit: "mmol/L" },
    { ...previous, category: "Urine" },
    { ...previous, observed_at: null },
    { ...previous, observed_at: "2026-09-21" },
    { ...previous, value: "<14" },
    { ...previous, test_name: "Urine hemoglobin" },
  ];
  assert.deepEqual(comparableReadings(observation(), invalid), []);
  assert.deepEqual(comparableReadings(observation(), [previous]), [previous]);
  assert.deepEqual(
    comparableReadings(observation(), [
      previous,
      { ...previous, id: "duplicate", report_id: "other" },
    ]),
    [],
  );
});
test("reference bars only use a single unambiguous printed interval", () => {
  assert.deepEqual(printedRange("12–16"), { low: 12, high: 16 });
  for (const raw of [
    "Male 12-16 Female 10-15",
    "<16",
    "1,2-1,6",
    "16-12",
    "0-5 years",
  ])
    assert.equal(printedRange(raw), null);
});
