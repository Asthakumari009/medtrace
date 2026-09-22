# MedTrace — implementation prompt

Paste this into a fresh Claude Code session at the repo root (`D:\projects\VITA`).
It is one job in nine parts. Do them in order; each part ends with a check you must run.

---

## 0. Ground rules (read before touching anything)

- This is **Expo SDK 57** (`expo@^57.0.9`, RN 0.86.3, Reanimated 4.5.1, React 19.2.3).
  `AGENTS.md` points at the v56 docs — that is stale. Read
  <https://docs.expo.dev/versions/v57.0.0/> for any Expo API you touch, and verify every
  native module's SDK-57 compatibility **before** installing it.
- Animation runtime is already chosen: **Reanimated 4**. Do not add anime.js, Motion, or
  GSAP to this repo. One runtime per job.
- Keep these green at every checkpoint — they are the only safety net:
  `npm run typecheck`, `npm test` (tsx, `tests/*.test.ts`), `npm run test:api`
  (python unittest in `api/`), `npm run test:e2e` (Playwright).
- Never edit `android/` by hand; it is prebuild output. Change `app.json` /
  `plugins/withHealthConnect` and re-prebuild.
- Demo device is a **vivo iQOO (Android)**. iOS paths must still compile, but Android is
  what gets measured. Demo date is fixed — if a part cannot be finished, ship the parts
  that can and say plainly which one you dropped. A cloud-only path presented honestly
  beats an on-device claim that breaks on stage.

---

## 1. Rename VITA → MedTrace

338 occurrences across 55 files (`rg -i vita`). Rename the **product**, not the
**identity**.

**Change:**
- `app.json` → `expo.name: "MedTrace"`; every permission-copy string
  (`expo-image-picker.cameraPermission`/`photosPermission`, healthkit
  `NSHealthShareUsageDescription`, `expo-audio.microphonePermission`).
- `package.json` → `"name": "medtrace"`.
- All user-visible strings in `src/i18n/locales/{en,hi,te}.ts` (9–10 hits each).
- Screen and component copy: `app/preview.tsx`, `app/device-check.tsx`,
  `app/(auth)/welcome.tsx`, `app/(tabs)/{chat,profile}.tsx`,
  `src/components/LaunchSequence.tsx`, `src/components/TabBar.tsx`,
  `src/components/health/{Dashboard,ExperienceSheets,Trends,Primitives}.tsx`.
- Backend: `api/main.py` (title/description), `api/chat.py` (system prompt persona —
  the assistant is now "MedTrace"), `api/schemas.py`, `api/doctor-web/index.html`.
- Docs: `INTERVIEW_BRIEF.md`, `docs/UPGRADE.md`, `README`/`AGENTS.md` if they name it.
- Comment headers in `src/ui/theme.ts`, `src/ui/ThemeContext.tsx`.

**Do NOT change** — these break the demo build and the OAuth client:
- `expo.slug` (`vita`) — EAS project linkage.
- `expo.scheme` (`vita`) — Google Sign-In / Supabase redirect URIs are registered
  against it.
- `android.package` and `ios.bundleIdentifier` (`com.vita.health`) — the Android package
  name is baked into the Google OAuth client and the SHA-1 fingerprint. Changing it
  silently kills `src/lib/googleAuth.ts` login.
- Supabase project refs, storage bucket name (`reports`), table names, migration files.

Add one line to `AGENTS.md`: *"Product name is MedTrace. Bundle id / slug / scheme stay
`vita` / `com.vita.health` — renaming them invalidates the Google OAuth client."*

**Check:** `rg -i "\bvita\b" app src api --glob '!*.lock'` returns only the identity
strings listed above. Then `npm run typecheck && npm test`.

---

## 2. On-device text recognition before upload (the real deliverable)

Today `src/lib/reports.ts` uploads the file to Supabase Storage and `api/extraction.py`
downloads it and hands the **whole image** to Gemini. Change it so an image is read on
the phone and, when the read is good, **only the extracted text leaves the device**.

**Library.** Verify against SDK 57 before installing, in this order:
1. `@react-native-ml-kit/text-recognition` — Google ML Kit on-device, no network. First
   choice: this repo already runs `expo prebuild` + `expo-dev-client`, so a bare native
   module is fine.
2. If it fails on RN 0.86 / Expo 57, fall back to `react-native-vision-camera` frame
   processors. Do not bring in a second camera stack if option 1 works.

If neither builds by the deadline, **stop and report it** — do not fake it with a
server-side call dressed as on-device.

**Flow** (`src/lib/reports.ts`, new `src/lib/ocr.ts`):

```
pick/capture  →  is it an image?
   no (PDF)   →  existing path: upload file, cloud extraction   (label: "read in cloud")
   yes        →  ML Kit recognize() on-device
                 confident?  (≥120 chars AND ≥1 numeric-with-unit match)
                    yes  →  POST text only to /extract. No image upload at all.
                    no   →  upload the image, cloud extraction. Tell the user why.
```

**Confidence gate** — put it in `src/lib/ocr.ts`, pure and unit-tested:
`ocrIsUsable(text): boolean`. Lab reports are numbers with units; garbage OCR is letters.
Require both a length floor and at least one `/\d+(\.\d+)?\s*(mg\/dL|g\/dL|mmol\/L|%|
mIU\/L|U\/L|mEq\/L|ng\/mL|10\^\d)/i` hit. Tune the floor against 3 real report photos on
the iQOO, not against synthetic text. Leave the thresholds as named exported constants —
they will need retuning on real paper under real light.

**Backend** (`api/extraction.py`, `api/schemas.py`, `api/main.py`):
- `/extract` accepts **either** `{storage_path}` (today) **or** `{text, source:
  "on_device_ocr"}`. Both routes end at the same Pydantic schema and the same
  re-validation — do not add a second validation path.
- Text input is still a trust boundary: cap length (e.g. 40 KB), reject empty/whitespace,
  and keep temperature 0 + schema-constrained decoding exactly as it is.
- Persist which path produced the row: add `extraction_source text` to the reports table
  via a **new** migration in `supabase/migrations/` (do not edit existing migrations).
  Regenerate `src/lib/database.types.ts`.

**UI.** In `src/components/AddReportSheet.tsx`, one honest line of state, not a badge
soup: *"Read on your phone — only the text was sent"* vs *"Sent for reading in the
cloud"*. Show it on `src/components/ReportCard.tsx` / `app/report/[id].tsx` too, driven
by `extraction_source`. The claim must be verifiable in the demo, so also surface it in
`app/device-check.tsx`.

**Privacy claim you have earned once this ships** (use this wording, nothing stronger):
*"Photographed reports are read on your phone. Only the extracted text goes to the cloud.
PDFs are still read in the cloud."*

**Checks:**
- `tests/ocr.test.ts` — `ocrIsUsable` accepts a real lab-text sample, rejects a
  garbage/short sample. tsx test, asserts only, no framework.
- `api/test_extraction.py` — text-input route returns the same validated shape as the
  storage route; over-length and empty text are rejected.
- On device: add a report by photo with **airplane mode off but network throttled** and
  confirm in `chrome-devtools`/`adb logcat` that no image upload request fires on the
  on-device path.

---

## 3. Kill the bounce

`src/ui/theme.ts` exports one spring (`SPRING = { damping: 18, stiffness: 180 }`) — that
is underdamped, i.e. it overshoots. Requirement is no bouncy animation anywhere.

Replace `SPRING` with duration+easing tokens and update every consumer:

```ts
// src/ui/theme.ts
export const DUR = { fast: 120, base: 180, slow: 260 } as const; // ms, nothing longer
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);   // decelerate, no overshoot
export const EASE_IN_OUT = Easing.bezier(0.4, 0, 0.2, 1);
```

Consumers to change (exact list from `rg`):
- `src/ui/motion.ts` — drop `.springify().damping().stiffness()`; use
  `FadeInDown.duration(DUR.base).easing(EASE_OUT)`.
- `src/ui/Sheet.tsx` (6 uses), `src/ui/PressableScale.tsx` (3),
  `src/ui/Toggle.tsx` (2), `src/ui/BarSeries.tsx` (2) — `withSpring` → `withTiming`.
- If any spring must stay (drag release on the sheet), make it **critically damped**:
  `{ damping: 26, stiffness: 220, mass: 1, overshootClamping: true }`.

`PressableScale`: scale to `0.98`, not lower, on `DUR.fast`. A press should read as
acknowledgement, not as a squish.

**Honor reduced motion.** Add `useReducedMotion()` from Reanimated in `src/ui/motion.ts`
and collapse entrances to duration 0 (not "slower") when it is on. Gate the ambient loops
in part 4 on the same flag.

**Check:** `rg "withSpring|springify" src app` returns nothing, or only the one clamped
sheet spring with a comment saying why. Then walk every screen on the iQOO and confirm
nothing overshoots.

---

## 4. 90+ on the demo device

Target: sustained 60 fps scroll and ≥90 on whatever `HackTracker` measures from device
data. Measure first, then cut. **Do not guess** — capture a baseline before any change.

**Measure (write the numbers into `docs/PERF.md`):**
- `adb shell dumpsys gfxinfo com.vita.health framestats` before/after, on the iQOO, in
  a **release** build (`npx expo run:android --variant release`) — dev-mode numbers are
  meaningless.
- Cold start: `adb shell am start -W -n com.vita.health/.MainActivity` → `TotalTime`.
- Bundle size: `npm run export:web` and the Android APK size from `build-release.log`.

**Cut, in expected-payoff order:**
1. **Ambient infinite loops.** `withRepeat` in `src/ui/Bloom.tsx`, `src/ui/Skeleton.tsx`,
   `src/ui/MetricTile.tsx`, `src/components/HomeHero.tsx`,
   `src/components/TypingIndicator.tsx`, `app/(tabs)/chat.tsx`. These never idle — they
   keep the UI thread and the GPU awake forever. Keep **at most one** (the chat typing
   indicator, which is meaningful), stop the rest when offscreen or delete them.
   `BREATH_MS` breathing on the home hero is the single biggest battery/fps tax here.
2. **Blur.** `expo-blur` is a dependency; `rg BlurView src app`. `BlurView` on Android is
   a real-time GPU readback and is the classic Android fps killer. Replace every one with
   a flat `colors.glass` fill. Then remove `expo-blur` from `package.json`.
3. **Gradients.** The new palette (part 5) is flat by design. Delete
   `gradientSets`/`GradientSet` and every `expo-linear-gradient` usage except, at most,
   the hero. Drop the dependency if it reaches zero uses.
4. **Shadows.** `ambientShadow`/`liftShadow` — Android `elevation` on many cards forces
   extra draw passes. Keep elevation on the tab bar and sheets only; elsewhere use a 1px
   `hairline` border. The reference designs do exactly this.
5. **Lists.** `@shopify/flash-list` is installed — confirm the timeline and records lists
   actually use it with a real `estimatedItemSize`, and that row components are
   `React.memo` with stable props (no inline object/arrow props in the render path).
6. **Startup.** `expo-router` `asyncRoutes` is off for native; leave it. Trim
   `src/components/LaunchSequence.tsx` to the shortest thing that hides the font swap —
   a launch animation is pure cold-start cost. Load only the font weights actually used
   (part 5), not all four of two families.
7. **Re-renders.** `src/ui/ThemeContext.tsx` must memoize its value object, or every
   theme consumer re-renders on every parent render. Check `useTheme()` call sites for
   destructuring that defeats it.

**Check:** `docs/PERF.md` has before/after for all three metrics from the release build
on the iQOO. If a change did not move a number, revert it.

---

## 5. New design system

Reference direction from the supplied images: **near-black canvas, white cards, one acid
lime accent, flat fills, no gradients, tight geometric type, generous radii, numbers as
the hero element.** That register is also the fastest to render — which is why it fits
part 4 instead of fighting it.

Rewrite `src/ui/theme.ts` (it is the single source of truth — nothing outside it defines
a value, keep that rule):

```ts
// dark — the primary scheme
ink: "#0B0C0B"        // canvas
surface: "#16181A"    // card
surfaceHi: "#FFFFFF"  // inverted card (the white tiles in the reference)
accent: "#D8FF3E"     // acid lime — ONE accent, used on <10% of any screen
onAccent: "#0B0C0B"   // black on lime; never white
text: "#F4F6F3"
textSoft: "rgba(244,246,243,0.62)"
textFaint: "rgba(244,246,243,0.38)"
hairline: "rgba(244,246,243,0.10)"
fill: "rgba(244,246,243,0.06)"
alert: "#FF6B4A"      // abnormal values ONLY
ok: "#6EE7A8"
// light — mirror it: #F6F7F4 canvas, #FFFFFF surface, #0B0C0B inverted, same lime.
```

Rules that keep it from turning into a mess:
- Lime is for **one** thing per screen: the primary action, or the one number that
  matters. Never for body text (it fails contrast on white) and never for "abnormal" —
  that is `alert`.
- Abnormal lab values must pass 4.5:1 in **both** schemes. Verify, do not assume.
- Semantic names only. No component may reference a hex.

**Typography.** Modern geometric grotesk, numbers first. Verify the package exists for
SDK 57 before installing; if `@expo-google-fonts/geist` is unavailable, use
`@expo-google-fonts/inter-tight` + `@expo-google-fonts/inter` and stop looking.

- Display / numbers: Geist (or Inter Tight), weight 600, **tracking −2%** at display
  sizes. The reference screens get their look almost entirely from tight tracking on big
  numerals.
- Body / UI: same family, 400/500.
- Enable **tabular figures** (`fontVariant: ["tabular-nums"]`) on every metric, lab value,
  and chart label so digits stop jittering.
- Remove `@expo-google-fonts/fraunces` and `@expo-google-fonts/dm-sans` once nothing
  imports them. Two families max, and only the weights in use.

```ts
typeScale = { caption: 12, label: 14, body: 16, heading: 20, title: 30, display: 44 }
radius   = { sm: 12, md: 18, lg: 26, pill: 999 }
```

Then sweep every component under `src/ui/` and `src/components/` so nothing references a
removed token. `src/ui/index.ts` is the barrel — the compiler will find them.

**Check:** `npm run typecheck`, then `npm run test:e2e` (`tests/e2e/preview.spec.ts` and
`mobile-matrix.spec.ts` screenshot the UI — update the baselines deliberately, and look
at each diff rather than blanket-accepting).

---

## 6. Cut the variable surface area

Anything half-built or dependent on a device/permission/network that might not behave on
stage is a liability in a five-minute demo. Keep the spine: **auth → add report →
on-device read → timeline → grounded chat → QR share to doctor.**

Audit and decide on each of these, and **write the decision down** in `docs/SCOPE.md`:

| Surface | Files | Default call |
|---|---|---|
| Wellness journal | `src/hooks/useWellnessJournal.ts`, `src/lib/wellness.ts`, `src/components/QuickLogSheet.tsx` | cut |
| Care questions | `src/hooks/useCareQuestions.ts` | cut |
| Symptom events | `src/lib/symptoms.ts`, `supabase/migrations/*symptom_events*` | cut UI, leave the table |
| Voice note chat | `src/hooks/useVoiceNote.ts`, `api/main.py /voice` | keep only if it works first try on the iQOO |
| hi / te locales | `src/i18n/locales/{hi,te}.ts`, `src/components/LanguagePicker.tsx` | keep en, hide the picker |
| Trends tab | `app/(tabs)/trends.tsx`, `src/components/health/Trends.tsx` | keep — it is the wearable story |
| Background health sync | `src/lib/health/backgroundTask.ts` | keep, but make a **manual sync** button the demo path |
| `app/preview.tsx`, `app/device-check.tsx` | — | keep, dev-only, not in the tab bar |

**"Cut" means delete the code**, not hide it behind a flag — a dead flag is the same
maintenance cost plus a bug waiting to fire. Drop the tab from
`app/(tabs)/_layout.tsx` and `src/components/TabBar.tsx`, delete the files, delete their
tests, and leave the Supabase tables alone (migrations are append-only).

⚠️ Confirm this table with the user before deleting anything — I inferred "remove variable
features" from context and these are real features, not scaffolding.

**Check:** `npm run typecheck && npm test && npm run test:api`. Tab bar has ≤4 tabs.

---

## 7. Vercel deploy readiness

Current `vercel.json` rewrites **everything** to `/api/index`, so the Expo web export is
not served at all — only the FastAPI app and the doctor page are reachable. Fix the split:

- Build command: `npm run export:web` → static output in `dist/`.
- Route `/api/*` and the doctor-view path to the Python function; everything else to the
  static export with a SPA fallback to `/index.html`.
- Keep `includeFiles: "api/doctor-web/**"`, `maxDuration: 60`, `memory: 1024`.
- Vercel's current recommendation is **`vercel.ts`** over `vercel.json` (install
  `@vercel/config`, export a typed `VercelConfig`). Migrate it — it is a 20-line file and
  removes the JSON-string guesswork. Delete `vercel.json` in the same commit; do not
  leave both.
- Env: everything in `api/` reads secrets from the environment. Confirm no secret is
  inlined, then `vercel env add` for each of the Supabase service key, the Vertex/Gemini
  credential, and the JWT issuer. `api/sa-vertex.json` is a local-only service-account key
  — verified untracked and already in `.gitignore:53-54`, so nothing to rotate. It will
  **not** exist on Vercel: confirm the Vertex client reads the credential from an env var
  and not from that path, or the deployed `/extract` and `/chat` endpoints break.
- Cache headers: immutable + 1 year on the hashed static assets, no-store on `/api/*`.
- The repo is **already linked** to a Vercel project: `.vercel/project.json` →
  `projectName: "vita-api"`. Do not `vercel link` again (it would create a second
  project). Reuse this one; renaming it in the Vercel dashboard is cosmetic and optional,
  and changes the default `*.vercel.app` hostname — so if a share/doctor URL is already
  printed on a slide or QR code, leave the name alone until after the demo.
- The Vercel CLI is not installed here. Tell the user to run `npm i -g vercel`, then
  `vercel env pull` and `vercel --prod` against the existing link.

**Check:** `npm run export:web` succeeds; `vercel build` locally produces both the static
output and the Python function; the doctor share link opens end to end against a preview
deployment (`tests/e2e/sharing.spec.ts`).

---

## 8. vivo Office Kit — on-device dev loop

No app code. This is the measured workflow item, and it is measured from device data, so
**start using it today** and keep using it — a single session on the last day will not
register.

On the iQOO (OriginOS): Settings → **Office Kit / Multi-Screen Collaboration**, pair with
the Windows machine over the same Wi-Fi. That gives you screen mirroring to the laptop,
two-way file transfer, and shared clipboard.

Then wire the dev loop to the **real phone**, never an emulator:
1. Enable Developer options → USB debugging, then **Wireless debugging**.
2. `adb pair <host>:<port>` with the on-screen code, then `adb connect <host>:<port>`.
3. `npx expo run:android --device` for the dev-client build, then `npx expo start
   --dev-client` for reloads over Wi-Fi.
4. Logs: `adb logcat -s ReactNativeJS:V ReactNative:V`.
5. Profiling and screenshots for the deck come off the same connection
   (`adb shell dumpsys gfxinfo`, `adb exec-out screencap -p > shot.png`).

Add these as npm scripts so the commands are recorded in the repo and repeatable:
`dev:device`, `logs:device`, `perf:device`, `shot:device`.

Record the setup in `docs/DEVICE.md` — mirroring on, file transfer used for pulling
report photos onto the phone, clipboard used for share links, and every profiling run
done over this connection.

---

## 9. Definition of done

- [ ] `rg -i "\bvita\b" app src api` → identity strings only; app shows **MedTrace**.
- [ ] Photographed report: ML Kit reads it on-device, only text hits the network, and the
      UI says so. PDF still routes to cloud and says *that*.
- [ ] `rg "withSpring|springify" src app` → empty (or one clamped, commented spring).
- [ ] `docs/PERF.md` has before/after framestats, cold start, and bundle size from a
      release build on the iQOO.
- [ ] New palette + type live in `src/ui/theme.ts`; no hex outside it; abnormal-value
      contrast ≥4.5:1 in both schemes.
- [ ] `docs/SCOPE.md` records what was cut, user-confirmed; ≤4 tabs.
- [ ] `vercel.ts` serves static web + Python API; preview deployment passes the sharing
      E2E; no key file in the repo.
- [ ] `docs/DEVICE.md` records the Office Kit + wireless-adb loop, in daily use.
- [ ] `npm run typecheck && npm test && npm run test:api && npm run test:e2e` all pass.

Report honestly at the end: what shipped, what did not, and what the demo should avoid.
