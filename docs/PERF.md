# Performance

Target: sustained 60 fps scroll and no dropped frames on the demo iQOO, in a **release**
build. Dev-mode numbers are meaningless — the JS bundle is unminified and the dev
overlay runs its own render loop.

## Status

**Not yet measured on the device.** The work below is done and verified by
`npm run typecheck && npm test && npm run test:api && npm run test:e2e` plus a
successful `expo export --platform web`, but no `framestats` has been captured on the
iQOO yet. The table stays empty until it is; do not quote a number that has not been
measured.

Run this on the phone (see `docs/DEVICE.md` for the connection), then fill the table:

```
npx expo run:android --variant release
adb shell am start -W -n com.vita.health/.MainActivity   # TotalTime = cold start
adb shell dumpsys gfxinfo com.vita.health reset
#   ... scroll Home and Documents hard for ~20s ...
npm run perf:device                                      # framestats
```

| Metric | Before | After |
|---|---|---|
| Cold start (`am start -W` TotalTime) | | |
| Janky frames, Home scroll | | |
| Janky frames, Documents scroll | | |
| Release APK size | | |
| Web bundle (`entry-*.js`) | | 1.1 MB |

If a change below did not move a number, revert it.

## What was cut, and why it should show up

In expected-payoff order.

1. **Every ambient `withRepeat` loop.** The home hero's breathing document, the Bloom's
   breath and 36s drift, the metric tiles' live dots, and the skeleton pulse never idled
   — they kept the UI thread and the GPU awake for as long as the screen was open. All
   removed; the skeleton is now a static fill. Two bounded loops remain (chat typing
   dots, voice-recording dot) and both stop when their pending state ends.
2. **All gradients.** `expo-linear-gradient` is uninstalled. The hero card, primary
   button, and the two ambient background orbs behind every `Screen` were composited
   per frame; the new palette is flat by design, so they had nothing to express.
3. **Blur.** `expo-blur` is uninstalled. `BlurView` on Android is a real-time GPU
   readback and is the classic mid-range fps killer.
4. **Shadows.** Card-level `ambientShadow` is gone. Android `elevation` on every card in
   a list is an extra draw pass each; a 1px hairline reads as a card edge for free, and
   it is what the reference design actually uses. One `liftShadow` remains, on the two
   surfaces that genuinely float (tab bar, sheet).
5. **The sheet stage transform.** Opening a sheet used to scale the entire app tree to
   0.96 behind it with `overflow: hidden` — a full-tree transform per frame for a
   flourish. Removed along with `SheetProvider`/`SheetStage`.
6. **Springs.** Every `withSpring` is now `withTiming` on `EASE_OUT`. Underdamped
   springs overshoot, which is both the "bouncy" feel being removed and extra frames
   settling after the gesture is over. Nothing animates longer than 260ms.
7. **NativeWind + Tailwind.** Zero `className=` in the codebase, so the babel transform
   and the runtime CSS-interop layer were pure overhead on every render and every cold
   start. Both uninstalled.
8. **The cold-start brand animation.** `LaunchSequence.tsx` (402 lines of SVG +
   Reanimated) ran before the first screen. The splash screen already covers the font
   load.
9. **Fonts: 5 faces → 3.** Two families (DM Sans ×4, Fraunces ×1) became Geist ×3.
   Every face is a blocking asset load before the first paint.
10. **The whole wearable layer.** Background task, foreground sync on every app
    resume, and a 45-day rollup query plus baseline computation on Home. All deleted
    with the feature (`docs/SCOPE.md`).
11. **Theme context memoization.** `ThemeProvider`'s value was already memoized; it now
    has one less field (`gradients`) to carry, and every theme consumer re-renders on
    scheme change only.

## Deliberately not done

- **FlashList on the Documents list.** `@shopify/flash-list` is installed and used in
  chat, but Documents stays on `FlatList`. Filtered rows can disappear mid-layout and
  the recycler processed stale size callbacks — a bug already hit and worked around in
  this repo. At a few dozen documents the windowed `FlatList` is well inside budget, and
  reintroducing a known crash before a demo is not a trade worth making.
  <!-- ponytail: revisit if a user ever has hundreds of documents. -->
