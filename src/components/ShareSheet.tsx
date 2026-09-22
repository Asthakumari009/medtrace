import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Check } from "lucide-react-native";
import QRCode from "react-native-qrcode-svg";
import {
  createShare,
  listShares,
  revokeShares,
  type ShareGrant,
  type ShareHistory,
} from "@/lib/share";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { Button, Input, PressableScale, Sheet, Text, useTheme } from "@/ui";
import { Tag } from "./health/Primitives";

type Choice = { id: string; title: string; report_date: string | null };
const sample: Choice[] = [
  {
    id: "sample-report-1",
    title: "Annual health check",
    report_date: "Illustrative report",
  },
  {
    id: "sample-report-2",
    title: "Complete blood count",
    report_date: "Illustrative report",
  },
];
export function ShareSheet({
  visible,
  onClose,
  demo = false,
  initialReportId,
}: {
  visible: boolean;
  onClose: () => void;
  demo?: boolean;
  initialReportId?: string;
}) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const [reports, setReports] = useState<Choice[]>([]);
  const [selected, setSelected] = useState<string[]>(
    initialReportId ? [initialReportId] : [],
  );
  const [recipient, setRecipient] = useState("");
  const [duration, setDuration] = useState(15);
  const [history, setHistory] = useState<ShareHistory[]>([]);
  const [grant, setGrant] = useState<ShareGrant | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const working = useRef(false);
  const revision = useRef(0);
  const userId = session?.user.id;
  useEffect(() => {
    setGrant(null);
    setHistory([]);
    setSelected(initialReportId ? [initialReportId] : []);
    setReports([]);
    setError(null);
    setNotice(null);
  }, [userId, initialReportId]);
  const refresh = useCallback(async () => {
    if (demo) {
      setReports(sample);
      return;
    }
    if (!userId) return;
    const epoch = revision.current;
    const [choices, shares] = await Promise.all([
      supabase
        .from("reports")
        .select("id, title, report_date")
        .eq("user_id", userId)
        .eq("status", "processed")
        .order("report_date", { ascending: false }),
      listShares(),
    ]);
    if (epoch !== revision.current) return;
    if (choices.error) throw new Error("Could not load reports. Try again.");
    setReports(choices.data);
    setHistory(shares.shares);
    setGrant((current) =>
      current && shares.shares.some((s) => s.id === current.id && !s.revoked_at)
        ? current
        : null,
    );
  }, [demo, userId]);
  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError(null);
    void refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [visible, refresh]);
  useEffect(() => {
    if (!visible || demo) return;
    let pending = false,
      stopped = false;
    const timer = setInterval(async () => {
      if (pending || working.current) return;
      pending = true;
      const epoch = revision.current;
      try {
        const data = await listShares();
        if (!stopped && epoch === revision.current) setHistory(data.shares);
      } catch {
        /* Initial load and explicit actions expose their errors. */
      } finally {
        pending = false;
      }
    }, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [visible, demo]);
  const run = async (action: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    revision.current++;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed. Try again.");
    } finally {
      revision.current++;
      working.current = false;
      setBusy(false);
    }
  };
  const mint = () =>
    run(async () => {
      if (demo) {
        setNotice(
          "Preview only. In your account, this creates a single-use QR for exactly the selected reports.",
        );
        return;
      }
      const fresh = await createShare({
        report_ids: selected,
        recipient_label: recipient.trim() || "My clinician",
        duration_minutes: duration,
      });
      setGrant(fresh);
      setClock(Date.now());
      await refresh();
    });
  const revoke = (id?: string) =>
    run(async () => {
      await revokeShares(id);
      setGrant((current) => (!id || id === current?.id ? null : current));
      setHistory((current) =>
        current.map((s) =>
          !id || s.id === id
            ? { ...s, revoked_at: new Date().toISOString() }
            : s,
        ),
      );
      setNotice(
        "Access revoked. Connected doctor views lock within about a second. Saved copies cannot be recalled.",
      );
    });
  const active = history.filter(
    (s) => !s.revoked_at && Date.parse(s.expires_at) > clock,
  );
  const seconds = grant
    ? Math.max(0, Math.ceil((Date.parse(grant.expires_at) - clock) / 1000))
    : 0;
  const currentRevoked =
    grant && history.some((s) => s.id === grant.id && s.revoked_at);
  const currentOpened =
    grant && history.some((s) => s.id === grant.id && s.opened_at);
  return (
    <Sheet visible={visible} onClose={onClose} title="You control access" closeLabel="Close sharing controls">
      <View style={{ gap: 16, paddingBottom: 12 }}>
        {demo && <Tag label="Sample sharing controls · no real access" />}
        <Text variant="label" tone="soft">
          Choose the reports your clinician can read, and for how long. Revoke
          access here at any time.
        </Text>
        {error && (
          <View style={{ gap: 8 }}>
            <Text accessibilityRole="alert" tone="alert" variant="caption">
              {error} Access is not confirmed revoked until the server
              acknowledges it.
            </Text>
            <Button
              title="Refresh access status"
              variant="secondary"
              onPress={() => void run(refresh)}
            />
          </View>
        )}
        {notice && (
          <Text accessibilityLiveRegion="polite" variant="caption" tone="accent">
            {notice}
          </Text>
        )}
        {!!active.length && (
          <Button
            title="Revoke all access now"
            loading={busy}
            variant="secondary"
            onPress={() => void revoke()}
          />
        )}
        {grant && seconds > 0 && !currentRevoked ? (
          <View style={{ gap: 13, paddingVertical: 10 }}>
            <Tag
              label={
                currentOpened
                  ? "Opened · live access"
                  : "Ready to scan · opens once"
              }
            />
            {!currentOpened && (
              <View
                style={{
                  padding: 15,
                  borderRadius: 18,
                  backgroundColor: "white",
                  alignSelf: "center",
                }}
              >
                <QRCode value={grant.share_url} size={188} />
              </View>
            )}
            <Text style={{ textAlign: "center" }} variant="label">
              {grant.recipient_label} · {grant.report_count} selected reports
            </Text>
            <Text style={{ textAlign: "center" }} variant="caption" tone="soft">
              Expires in {Math.floor(seconds / 60)}:
              {String(seconds % 60).padStart(2, "0")}
            </Text>
            <Button
              title="Revoke this access"
              variant="secondary"
              loading={busy}
              onPress={() => void revoke(grant.id)}
            />
          </View>
        ) : (
          <>
            <Input
              accessibilityLabel="Recipient label"
              placeholder="Clinician or appointment label (optional)"
              value={recipient}
              onChangeText={setRecipient}
              maxLength={100}
            />
            <Text variant="caption" tone="soft">
              This label does not verify identity. Anyone with the QR can open
              it once.
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[5, 15, 30].map((minutes) => (
                <PressableScale
                  key={minutes}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: duration === minutes }}
                  accessibilityLabel={`${minutes} minutes`}
                  onPress={() => setDuration(minutes)}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 12,
                    backgroundColor:
                      duration === minutes ? colors.fill : colors.fill,
                  }}
                >
                  <Text variant="caption">{minutes} min</Text>
                </PressableScale>
              ))}
            </View>
            <Text variant="label">
              Select reports · {selected.length} chosen
            </Text>
            {loading && (
              <Text variant="caption" tone="soft">
                Loading your reports and access history…
              </Text>
            )}
            {reports.map((r) => (
              <PressableScale
                key={r.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected.includes(r.id) }}
                accessibilityLabel={`Share ${r.title}`}
                onPress={() =>
                  setSelected((list) =>
                    list.includes(r.id)
                      ? list.filter((id) => id !== r.id)
                      : list.length < 100
                        ? [...list, r.id]
                        : list,
                  )
                }
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 13,
                  borderBottomWidth: 1,
                  borderColor: colors.hairline,
                }}
              >
                <View
                  style={{
                    width: 23,
                    height: 23,
                    borderRadius: 7,
                    borderWidth: 1,
                    borderColor: colors.ink,
                    backgroundColor: selected.includes(r.id)
                      ? colors.fill
                      : colors.surface,
                  }}
                >
                  {selected.includes(r.id) && (
                    <Check size={21} color={colors.ink} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="label">{r.title}</Text>
                  <Text variant="caption" tone="soft">
                    {r.report_date ?? "Date not recorded"}
                  </Text>
                </View>
              </PressableScale>
            ))}
            {!loading && !reports.length && (
              <Text variant="caption" tone="soft">
                Add a report and wait for processing to finish before sharing.
              </Text>
            )}
            <Button
              title={demo ? "Preview selected access" : "Create single-use QR"}
              disabled={!selected.length || loading}
              loading={busy}
              onPress={() => void mint()}
            />
            <Text variant="caption" tone="soft">
              Creating a new QR ends previous shares, including ones already
              opened. New uploads are never added to an existing share.
            </Text>
          </>
        )}
        <View style={{ gap: 14, marginTop: 10 }}>
          <Text variant="heading">Access history</Text>
          {!history.length && (
            <Text variant="caption" tone="soft">
              No recent shares. Opening these controls does not grant access.
            </Text>
          )}
          {history.map((s) => {
            const live = !s.revoked_at && Date.parse(s.expires_at) > clock;
            const status = s.revoked_at
              ? "Revoked"
              : !live
                ? "Expired"
                : s.opened_at
                  ? "Opened · active"
                  : "Waiting to open";
            return (
              <View
                key={s.id}
                style={{
                  borderTopWidth: 1,
                  borderColor: colors.hairline,
                  paddingTop: 13,
                  gap: 5,
                }}
              >
                <Text variant="label">{s.recipient_label}</Text>
                <Text variant="caption" tone="soft">
                  {status} · {s.report_count} reports ·{" "}
                  {new Date(s.created_at).toLocaleString()}
                </Text>
                {s.opened_at && (
                  <Text variant="caption" tone="soft">
                    Opened {new Date(s.opened_at).toLocaleString()}
                  </Text>
                )}
                {live && (
                  <Button
                    title={`Revoke ${s.recipient_label}`}
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onPress={() => void revoke(s.id)}
                  />
                )}
              </View>
            );
          })}
        </View>
        <Text variant="caption" tone="soft">
          Live views require a continuous connection and clear when permission
          ends. Screenshots, photos, and information already saved cannot be
          recalled.
        </Text>
      </View>
    </Sheet>
  );
}
