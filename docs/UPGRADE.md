# MedTrace experience upgrade

MedTrace is an Expo 57 / React Native 0.86.3 application using Expo Router, TypeScript, Reanimated, a shared themed component library, Supabase authentication/storage/Postgres, and a Python FastAPI service with Gemini on Vertex AI. Its existing core is medical-report extraction, a chronological health record, cited AI answers and voice questions, wearable readings, symptom logging, and expiring doctor-sharing links.

## Implemented

- A responsive Today dashboard using the supplied references: warm ivory, apricot, forest, serif display type, compact metric tiles, date navigation, and a five-destination bottom navigation. Dark mode and tablet/web layouts share the same components.
- Daily mood check-ins, editable hydration goals with add/undo, reflections, and a routine-completion ring. The ring measures three personal routines; it is **not a medical score**.
- An account-scoped, on-device journal, with validation, serialized writes, visible save failures, a rolling 90-day history, and foreground/midnight date refresh. The journal is not sent to the AI service or synced between devices.
- Interactive 7/14/30-day metric charts with selectable dates, missing-day gaps, coverage counts, daily summary labels, exact measurement dates, source information, and personal baseline context.
- Searchable records with report/symptom/pattern/lab-flagged filters. Controls scroll with the list so short phone screens retain usable space. Upload/retry flows remain connected; browser uploads now read browser files correctly, reject empty/oversize files, and handle picker errors.
- A redesigned report reader with original-document access for the owner, searchable/category-filtered tests, flagged-first ordering, exact source text, printed reference ranges, date-aware trend lines, and links to earlier reports. Comparisons require matching test/category/unit, exact numeric values, earlier dates, and no same-day ambiguity.
- Plain-language explanations for HbA1c, hemoglobin, and glucose link to MedlinePlus (source pages checked on 2026-09-20). Report-specific questions can be saved, marked discussed, removed, and included in a reviewed visit brief. These questions are account-scoped on-device data, not AI requests.
- Explicit report selection, recipient labels, 5/15/30-minute grants, opened/revoked history, and individual/all-grant revocation. Opening sharing controls never creates a grant. Recipient labels do not verify clinician identity.
- A deterministic visit brief containing optional readings, reports, symptoms, and editable questions. Users review it before downloading on web or opening the native share sheet. It sends nothing automatically.
- A public `/preview` route with explicitly labeled synthetic data. It reuses the production screens, makes no AI request, and keeps preview check-ins only in memory. Authentication still protects the real tabs and backend.
- A refreshed welcome screen and AI conversation styling.
- A new cold-start intro: a drawn pulse and orbit, six-spoke brand mark, staggered MedTrace lettering, and a soft dissolve into the app. It uses existing Reanimated/SVG dependencies, lasts about 2.8 seconds, runs once per process, can be skipped, and has a quiet reduced-motion variant. A fallback ensures animation failure cannot trap navigation.

## Accuracy and reliability changes

- Pattern detection requires five **consecutive complete calendar days** ending yesterday, a separate 14-day-minimum baseline within a 30-day historical window, and a consistent device source. Missing days, duplicate days, partial current days, and stale runs do not count. A small relative floor handles flat baselines without treating tiny changes as drift.
- Baseline/chart data remain source-specific; HealthKit SDNN and Health Connect RMSSD are not mixed as equivalent HRV readings.
- Latest readings are dated and daily averages are not presented as live measurements. Incomplete daily totals are not compared against complete-day baselines.
- AI grounding preserves raw latest values and units, uses calendar windows instead of the last seven rows, identifies stale/incomplete data, and states actual baseline coverage. It separates device sources and filters invalid/future records.
- Overlapping sleep intervals are merged. Android reads all result pages and uses native calendar-day aggregation for steps and active energy. Android sleep requires actual asleep-stage evidence; unclassified sessions are withheld rather than labeled as measured sleep.
- Non-finite extracted numbers cannot enter numeric trend calculations. Record text is explicitly treated as untrusted data by the AI prompts. Prompts forbid causal inference from correlated wearable data and avoid reassurance based on old records in an urgent situation.
- Concurrent sync calls share one request. Timeline queries run concurrently, retain previous data on failure, and avoid overlapping polls. Chat prevents duplicate sends and submits only the latest 30 turns.
- Wearable preferences and last-sync dates are now account-scoped. Legacy unscoped preferences are intentionally not copied across accounts: existing installations need to reconnect their chosen health metrics once.

## Performance and compatibility

The exact SDK 56 documentation was read before implementation. Expo Doctor then identified the SDK 56 Hermes V1 memory regression affecting Reanimated/worklets. Following the official SDK 57 release notes and versioned documentation, the app was upgraded to Expo 57.0.24 / React Native 0.86.3 and compatible modules. Expo Doctor passes all 21 checks. Generated Android files use the matching SDK 57 template.

Fonts are imported individually (five font assets, roughly 296 KB total). Production web routes load asynchronously. Long record/conversation lists remain virtualized. The intro uses local vector assets and UI-thread animation. Web focus states are visible, and selected/checked control states are exposed to assistive technology. Layouts allow rotation, tablets, safe-area insets, larger system text, and scrolling sheets with keyboard avoidance. Release builds enable R8, resource shrinking, bundle compression, HTTPS-only Android transport, and disabled Android backup.

The SDK upgrade removed the four high-severity dependency advisories. The 2026-09-20 audit reports 17 moderate advisories, rooted in `decode-uri-component` (router query parsing) and `uuid` (native-project/tunnel tooling). The suggested npm force fixes downgrade Expo/router; they were not applied. Reassess upstream fixes and malformed-link handling before distribution.

## Verification

```powershell
npm run typecheck
npm test
npm run test:api
npx expo install --check
npx expo export --platform web --output-dir artifacts/web
node tests/serve-preview.cjs
# In a second terminal:
$env:VITA_TEST_URL = 'http://localhost:8083'
npm run test:e2e
```

All 49 automated scenarios pass on SDK 57: 14 TypeScript data/storage tests, 14 Python/API tests, and 21 browser scenarios. A records-filter crash found during the SDK upgrade was fixed by disabling stale scroll anchoring; a regression test repeatedly narrows, empties, and restores search results. See the device test record for final build and hardware results; JavaScript exports alone do not verify native behavior.

The browser suite covers intro/skip behavior, live-view revocation, delayed responses, connection loss, hidden-page revalidation, the preview flow, mood persistence between tabs, water entry and goal validation, reflections, chart controls, record search/filter/detail, reviewed brief download, theme switching, and welcome navigation. Chromium and WebKit exercise six viewports from 320×568 through 1180×820, including phone landscape. Unit tests cover calendar gaps, stale/incomplete runs, device-source differences, duplicate readings, flat baselines, overlapping sleep, journal validation/retention, numeric precision, AI evidence windows, and encrypted storage migration/failure/concurrency. Generated screenshots, the recorded `artifacts/vita-intro.webm`, and sample exports are in the ignored `artifacts` directory. Tests use synthetic data and mocked authorization responses; no real medical account was used.

## Release boundaries

This upgrade does not claim clinical validation, diagnoses, emergency monitoring, or a globally novel medical capability. It adds useful, inspectable workflows around MedTrace's existing product.

- Native HealthKit/Health Connect permission flows, sensor reconciliation, background execution, camera, microphone, and sharing need testing on physical iOS/Android devices. Native dependencies changed, so rebuild the development client/native app.
- Live authenticated backend calls and AI quality need staging/integration evaluation. No production data was modified and no backend deployment or database migration was performed.
- Existing English/Hindi/Telugu authentication, settings, and AI language support remains. The redesigned report reader, sharing controls, dashboard, trends, journal, and visit-brief copy currently use English and need complete localization before a multilingual release.
- Native auth sessions, journal entries, and saved questions use AES-GCM ciphertext in AsyncStorage with a device-held SecureStore key. Plaintext migration removes the original only after an encrypted round-trip check. Damaged/swapped ciphertext fails closed. The key remains accessible after first unlock for background sync. Web persistence retains browser-origin protection and is not equivalent to native Keychain/Keystore. Cloud report security still depends on Supabase RLS and deployment configuration.

Production EAS builds run `scripts/check-release.cjs` to validate public configuration without printing secrets. The gate rejects non-HTTPS endpoints, privileged public keys, and the internal device-check flag. GitHub Actions runs type, unit, API, dependency, web-export, and Chromium/WebKit checks. These gates do not replace staging, signing, privacy declarations, or clinical evaluation.


## Revocable sharing protocol and deployment

The old implementation only revoked unused QR codes and returned an irrevocable snapshot after redemption. The replacement revokes opened grants too, and requires every viewer request to validate the current database grant.

- `POST /share` authenticates the patient, freezes selected processed report IDs in `scope`, ends previous grants, and returns a single-use URL. Its token is in the URL fragment, absent from HTTP request paths.
- `POST /share/redeem` atomically guards unused/unrevoked/unexpired status and returns an in-memory viewer credential. Only its SHA-256 hash is stored. It returns no medical data.
- `POST /share/records` validates permission before and after fetching scoped records. Results are paginated to avoid PostgREST's typical 1,000-row response cap. Doctor responses never include original-file signed URLs.
- `POST /share/session` checks the database again. The official viewer renews a **900ms lease**, anchored to request start rather than response arrival, with one in-flight check. Failed checks or expired leases clear patient identity and record DOM. A CSS visibility timeout supplements the JS watchdog. Hiding/leaving the page clears the view; resuming requires revalidation. No medical data is put in browser storage.
- `POST /share/revoke` uses server timestamps and patient ownership, regardless of whether a link was opened. The patient UI only announces success after acknowledgement. Stale polling responses cannot overwrite an acknowledged local revocation.
- Responses use `no-store`; the standalone viewer has a strict same-origin CSP, no third-party scripts or fonts, and no-referrer/frame protections.

**Limits:** the server rejects further reads as soon as revocation commits. The supported live viewer is designed to lock within roughly one second and passes synthetic browser tests, but production latency, device scheduling, and browser behavior still need staging verification. No web application can erase screenshots, downloaded/copied data, an old snapshot already delivered by the previous implementation, or information retained by a modified client. The product states this boundary.

Deploy the new API, `api/sharing.py`, and all `api/doctor-web` assets together with the app. Existing Vercel `includeFiles` already includes these assets. No new database migration is required: grants use the existing `share_tokens.scope` JSON column. Legacy-version grants fail closed under the new API and need new links; previously delivered legacy snapshots cannot be recalled. Do not roll out the new app against the old sharing API.

Set `VITA_ALLOWED_ORIGINS` to the deployed web app's exact origin(s), comma-separated. Local defaults permit ports 8082 and 8083. Authentication remains required regardless of CORS. The service-role Supabase client is reused for connection pooling. Load-test the short lease/poll interval with production latency and concurrent viewers before promising a service-level guarantee.

The owner-only original-document action uses a separate 60-second signed storage URL. It is not issued to doctor viewers and is not governed by doctor-share revocation.
