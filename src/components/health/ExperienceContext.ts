import { createContext, useContext } from "react";

import type { ObservationStats, ReportClinical } from "@/hooks/useTimeline";
import type { ReportRow, TimelineEventRow } from "@/lib/database.types";

export type Destination = "home" | "records" | "chat" | "profile";
export type HealthAction = "add" | "share" | null;

export interface HealthData {
  name: string;
  events: TimelineEventRow[];
  pending: ReportRow[];
  stats: Record<string, ObservationStats>;
  clinical: Record<string, ReportClinical>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface Experience extends HealthData {
  demo: boolean;
  goTo: (destination: Destination) => void;
  action: (action: HealthAction) => void;
  openReport: (event: TimelineEventRow) => void;
  refreshing: boolean;
  /** Documents on the timeline, flagged values across all of them. */
  totals: { documents: number; flagged: number; values: number };
}

export const Context = createContext<Experience | null>(null);

export function useExperience(): Experience {
  const value = useContext(Context);
  if (!value) throw new Error("Record screens require ExperienceProvider");
  return value;
}
