import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "expo-router";

import { useTimeline } from "@/hooks/useTimeline";
import type { TimelineEventRow } from "@/lib/database.types";
import { displayName } from "@/lib/user";
import { useAuth } from "@/providers/AuthProvider";

import {
  Context,
  type Destination,
  type HealthAction,
  type HealthData,
} from "./ExperienceContext";
import { ExperienceSheets } from "./ExperienceSheets";

export {
  useExperience,
  type HealthAction,
  type HealthData,
  type Destination,
} from "./ExperienceContext";

export function ExperienceProvider({
  children,
  data,
  demo = false,
  navigate,
}: {
  children: ReactNode;
  data: HealthData;
  demo?: boolean;
  navigate: (destination: Destination) => void;
}) {
  const router = useRouter();
  const [action, setAction] = useState<HealthAction>(null);
  const [report, setReport] = useState<TimelineEventRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await data.refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const totals = useMemo(() => {
    let flagged = 0;
    let values = 0;
    for (const stat of Object.values(data.stats)) {
      flagged += stat.flagged;
      values += stat.count;
    }
    return { documents: data.events.length, flagged, values };
  }, [data.events, data.stats]);

  return (
    <Context.Provider
      value={{
        ...data,
        demo,
        totals,
        refreshing,
        refresh,
        action: setAction,
        goTo: navigate,
        openReport: (event) => {
          if (demo || !event.report_id) setReport(event);
          else
            router.push({
              pathname: "/report/[id]",
              params: { id: event.report_id },
            });
        },
      }}
    >
      {children}
      <ExperienceSheets
        action={action}
        onClose={() => setAction(null)}
        report={report}
        closeReport={() => setReport(null)}
      />
    </Context.Provider>
  );
}

const paths = {
  home: "/(tabs)",
  records: "/(tabs)/records",
  chat: "/(tabs)/chat",
  profile: "/(tabs)/profile",
} as const;

export function LiveExperience({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { session } = useAuth();
  const timeline = useTimeline();

  return (
    <ExperienceProvider
      navigate={(destination) => router.navigate(paths[destination])}
      data={{
        name: displayName(session) ?? "there",
        events: timeline.events ?? [],
        pending: timeline.pending ?? [],
        stats: timeline.stats,
        loading: timeline.events === null,
        error: timeline.error,
        refresh: timeline.refresh,
      }}
    >
      {children}
    </ExperienceProvider>
  );
}
