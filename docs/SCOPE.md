# Scope — what MedTrace is, and what was cut

Decided 2026-09-21. The app is a **medical-document record**: add a report, have it
read, search it, ask about it, share it with a doctor. Nothing else.

The spine, in order: **auth → add report → read it (on-device for photos) → documents →
grounded chat → one-time QR share**.

## Removed

Deleted outright, not hidden behind a flag — a dead flag is the same maintenance cost
plus a bug waiting to fire. The Supabase tables stay, because migrations are
append-only and dropping them would break the doctor-view history of anyone who
already has rows.

| Removed | Files deleted |
|---|---|
| **Watch / wearable connection** (Apple Health, Health Connect, background sync, daily rollups, baselines, drift patterns) | `src/lib/health/*`, `src/hooks/{useHealthSync,useEnabledMetrics,useInsights}.ts`, `src/components/HealthSheet.tsx`, `plugins/withHealthConnect.js` |
| **Trends tab** (metric charts, day scrubber) | `app/(tabs)/trends.tsx`, `src/components/health/Trends.tsx` |
| **Metric dashboard** (tiles, sparklines, counting numbers, the Bloom) | `src/ui/{MetricTile,Sparkline,BarSeries,AnimatedNumber,Bloom}.tsx`, `src/components/metricIcons.ts` |
| **Wellness journal** (mood, hydration, daily note, rhythm ring) | `src/hooks/useWellnessJournal.ts`, `src/lib/wellness.ts`, `src/components/QuickLogSheet.tsx` |
| **Symptom logging** | `src/lib/symptoms.ts` |
| **Care questions + visit brief** (saved questions, brief export) | `src/hooks/useCareQuestions.ts`, the visit-brief sheet in `ExperienceSheets.tsx`, the question block in `ReportReader.tsx` |
| **Hindi / Telugu** | `src/i18n/locales/{hi,te}.ts`, `src/components/LanguagePicker.tsx`. i18n stays wired with English only. |
| **Cold-start brand animation** | `src/components/LaunchSequence.tsx` — pure startup cost; the splash screen already covers the font load |
| **Wearable AI grounding** | `api/grounding.py`, its test, and the `metric_daily_rollups` query in `_load_grounding` — nothing can write that table any more, so the query was a round-trip per chat for an always-empty block |
| **NativeWind + Tailwind** | `tailwind.config.js`, `nativewind-env.d.ts`, and their metro/babel wiring. Zero `className=` in the codebase: it was a babel transform and a runtime CSS-interop layer running for nothing. `global.css` stays for the web export's reduced-motion and focus-ring rules. |
| **Ambient animation** | The `withRepeat` breathing loops on the home hero, skeletons, metric tiles and the Bloom. Two bounded loops remain: chat typing dots and the voice-recording dot, both tied to a pending state rather than always on. |

## Kept

- **Voice questions** (`useVoiceNote`, `POST /voice`) — part of chat, works today.
- **Preview / sample data** (`app/preview.tsx`, `src/lib/demo.ts`) — it is what the
  Playwright suite drives, and the only way to see the UI without an account.
- **Device check** (`app/device-check.tsx`) — internal builds only, gated by
  `EXPO_PUBLIC_ENABLE_DEVICE_CHECKS`; `scripts/check-release.cjs` rejects it in store builds.
- **Report reader** in full: extracted values, printed reference ranges, range bars,
  comparisons against earlier reports, MedlinePlus context.

## Identity that did NOT change

Renaming any of these breaks the existing build or signs users out. They stay `vita`:

- `expo.slug`, `expo.scheme`
- `android.package` / `ios.bundleIdentifier` → `com.vita.health` (baked into the Google
  OAuth client and its SHA-1)
- `VITA_ALLOWED_ORIGINS` env var, Supabase project refs, the `reports` storage bucket
- Local storage key prefixes: `vita.encrypted.v1.*`, `vita.local-encryption-key.v1`,
  `vita.language`
