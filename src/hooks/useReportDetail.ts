import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ObservationRow,
  ReportRow,
  TimelineEventRow,
} from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
interface Detail {
  report: ReportRow | null;
  event: TimelineEventRow | null;
  observations: ObservationRow[];
  history: ObservationRow[];
  error: string | null;
  historyError: string | null;
}
const empty: Detail = {
  report: null,
  event: null,
  observations: [],
  history: [],
  error: null,
  historyError: null,
};
export function useReportDetail(reportId: string) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const scope = `${userId ?? ""}:${reportId}`;
  const [state, setState] = useState({ scope, data: empty });
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const epoch = ++generation.current;
    setState({ scope, data: empty });
    if (!userId || !reportId) return;
    try {
      const [report, event, observations, recent] = await Promise.all([
        supabase
          .from("reports")
          .select("*")
          .eq("id", reportId)
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("timeline_events")
          .select("*")
          .eq("report_id", reportId)
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("extracted_observations")
          .select("*")
          .eq("report_id", reportId)
          .eq("user_id", userId)
          .order("category"),
        supabase
          .from("reports")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "processed")
          .neq("id", reportId)
          .order("report_date", { ascending: false })
          .limit(30),
      ]);
      if (epoch !== generation.current) return;
      if (report.error || !report.data || observations.error)
        throw new Error(
          "This report could not be loaded. It may have been removed, or the connection may be unavailable.",
        );
      const data: Detail = {
        ...empty,
        report: report.data,
        event: event.data,
        observations: observations.data,
      };
      setState({ scope, data });
      if (recent.error) {
        setState({
          scope,
          data: { ...data, historyError: "Earlier results could not load." },
        });
        return;
      }
      if (recent.data.length) {
        const history = await supabase
          .from("extracted_observations")
          .select("*")
          .eq("user_id", userId)
          .in(
            "report_id",
            recent.data.map((r) => r.id),
          )
          .order("observed_at", { ascending: false })
          .limit(1000);
        if (epoch === generation.current)
          setState({
            scope,
            data: {
              ...data,
              history: history.data ?? [],
              historyError: history.error
                ? "Earlier results could not load."
                : null,
            },
          });
      }
    } catch (e) {
      if (epoch === generation.current)
        setState({
          scope,
          data: {
            ...empty,
            error:
              e instanceof Error ? e.message : "Could not load the report.",
          },
        });
    }
  }, [userId, reportId, scope]);
  useEffect(() => {
    void refresh();
    return () => {
      generation.current++;
    };
  }, [refresh]);
  return { ...(state.scope === scope ? state.data : empty), refresh };
}
