import type { HealthData } from "@/components/health/Experience";
import type { ReportClinical } from "@/hooks/useTimeline";

import type {
  ObservationRow,
  ReportRow,
  TimelineEventRow,
} from "./database.types";

function dayOffset(back: number): string {
  const date = new Date();
  date.setDate(date.getDate() - back);
  return date.toISOString().slice(0, 10);
}

/** One source for both the searchable timeline and the report screen:
 *  the sample must not claim a drug the sample report screen never shows. */
const DEMO_CLINICAL = {
    "sample-report-1": {
      doctor_name: "Dr. Meera Iyer",
      facility_name: "Lakeside Family Clinic",
      diagnoses: ["Prediabetes"],
      medications: [
        { name: "Metformin", dose: "500 mg", frequency: "1-0-1", duration: "3 months" },
        { name: "Vitamin D3", dose: "60,000 IU", frequency: "Once weekly", duration: "8 weeks" },
      ],
    },
    "sample-report-2": {
      doctor_name: null,
      facility_name: "Sunrise Diagnostics",
      diagnoses: [],
      medications: [],
    },
} satisfies Record<string, ReportClinical>;

/** Explicitly illustrative, never loaded into an authenticated user's records. */
export function demoHealthData(): HealthData {
  const base = {
    user_id: "sample",
    created_at: new Date().toISOString(),
    metric: null,
    event_type: "report" as const,
  };
  const events: TimelineEventRow[] = [
    {
      ...base,
      id: "sample-report-1",
      report_id: "sample-report-1",
      title: "Annual health check",
      occurred_at: dayOffset(3),
      summary:
        "A sample report with 12 recorded observations. One value is marked for follow-up by the laboratory.",
    },
    {
      ...base,
      id: "sample-report-2",
      report_id: "sample-report-2",
      title: "Complete blood count",
      occurred_at: dayOffset(12),
      summary:
        "An illustrative record containing 8 observations. No values are marked by the sample laboratory.",
    },
  ];
  return {
    name: "Alex",
    events,
    pending: [],
    stats: {
      "sample-report-1": { count: 12, flagged: 1 },
      "sample-report-2": { count: 8, flagged: 0 },
    },
    clinical: DEMO_CLINICAL,
    loading: false,
    error: null,
    refresh: async () => {},
  };
}

/** Coherent illustrative reports used by the same reader as live records. */
export function demoReport(id: string): {
  report: ReportRow;
  observations: ObservationRow[];
  history: ObservationRow[];
} {
  const events = demoHealthData().events;
  const event = events.find((e) => e.report_id === id) ?? events[0]!;
  const day = event.occurred_at;
  const make = (
    reportId: string,
    date: string,
    previous: boolean,
  ): ObservationRow[] => {
    const rows: [string, string, string, string, string][] = [
      [
        "Hemoglobin",
        previous ? "13.6" : "14.2",
        "g/dL",
        "12–16",
        "Blood count",
      ],
      ["Hematocrit", "42", "%", "36–46", "Blood count"],
      ["Red blood cells", "4.7", "million/µL", "4.0–5.2", "Blood count"],
      ["White blood cells", "6.3", "thousand/µL", "4–11", "Blood count"],
      ["Platelets", "256", "thousand/µL", "150–400", "Blood count"],
      ["Mean corpuscular volume", "89", "fL", "80–100", "Blood count"],
      ["Mean corpuscular hemoglobin", "30", "pg", "27–33", "Blood count"],
      [
        "Mean corpuscular hemoglobin concentration",
        "34",
        "g/dL",
        "32–36",
        "Blood count",
      ],
    ];
    if (!previous)
      rows.push(
        ["HbA1c", "5.8", "%", "4.0–5.6", "Blood glucose"],
        ["Fasting glucose", "88", "mg/dL", "70–99", "Blood glucose"],
        ["Creatinine", "0.9", "mg/dL", "0.6–1.2", "Kidney panel"],
        ["Sodium", "139", "mmol/L", "135–145", "Kidney panel"],
      );
    return rows.map(
      ([test_name, value, unit, reference_range, category], i) => ({
        id: `${reportId}-value-${i}`,
        user_id: "sample",
        report_id: reportId,
        test_name,
        value,
        unit,
        value_numeric: Number(value),
        reference_range,
        category,
        observed_at: date,
        flagged: test_name === "HbA1c",
        created_at: date,
      }),
    );
  };
  return {
    report: {
      id,
      user_id: "sample",
      title: event.title,
      report_date: day,
      file_path: "sample/report.pdf",
      file_type: "pdf",
      status: "processed",
      extraction_source: "cloud",
      // A lab report names the lab and nothing else; the annual check-up is a
      // consultation note, so it carries the clinician, the stated condition
      // and what was prescribed. Both shapes are what real documents look like.
      ...(DEMO_CLINICAL[id as keyof typeof DEMO_CLINICAL] ??
        DEMO_CLINICAL["sample-report-1"]),
      error_message: null,
      created_at: day,
      updated_at: day,
    },
    observations: make(id, day, id === "sample-report-2"),
    history:
      id === "sample-report-1"
        ? make(
            "sample-report-2",
            events.find((e) => e.id === "sample-report-2")!.occurred_at,
            true,
          )
        : [],
  };
}
