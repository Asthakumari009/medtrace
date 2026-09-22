# MedTrace

## Expo HAS CHANGED

This project is on **Expo SDK 57** (`expo@^57`, RN 0.86, Reanimated 4, React 19).
Read the exact versioned docs at <https://docs.expo.dev/versions/v57.0.0/> before
writing any code. Verify a native module's SDK-57 support before installing it.

## Name vs. identity

The product is **MedTrace**. The build identity is still `vita` and must stay that way:

- `expo.slug` and `expo.scheme` → `vita`
- `android.package` / `ios.bundleIdentifier` → `com.vita.health`, baked into the Google
  OAuth client and its SHA-1 fingerprint. Renaming it kills `src/lib/googleAuth.ts`.
- `VITA_ALLOWED_ORIGINS`, Supabase project refs, the `reports` bucket, and the
  `vita.*` local storage key prefixes.

## Design system

`src/ui/theme.ts` is the single source of truth. Nothing outside it defines a color,
size, radius, duration, or easing — components resolve color through `useTheme()`.

- Near-black canvas, flat surfaces, **one** acid-lime accent per screen, tight
  geometric type (Geist), numbers as the hero element.
- `colors.accent` is a **fill only**, always paired with `onAccent` text. For accent
  text or icons use `colors.accentInk`, which is contrast-safe in both schemes.
- `colors.alert` is for abnormal lab values and errors, nothing else.
- Every metric and lab value uses `tabularNums` so digits do not jitter.

## Motion

**No springs, no bounce, nothing ambient.** `withTiming` on `EASE_OUT`/`EASE_IN_OUT`
only, and nothing longer than `DUR.slow` (260ms). Reanimated 4 is the only animation
runtime — do not add anime.js, Motion, or GSAP. An infinite `withRepeat` must be tied
to a pending state that ends.

## Checks

`npm run typecheck && npm test && npm run test:api && npm run test:e2e`.
`npm run export:web` must succeed. Never hand-edit `android/` — it is prebuild output.

See `docs/SCOPE.md` for what the app deliberately does not do, `docs/PERF.md` for the
performance budget, and `docs/DEVICE.md` for the on-device loop.
