import { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";

import { DUR, EASE_OUT, STAGGER_MS } from "./theme";

/**
 * Standard entrance: fade + 8px rise, decelerating to rest. No spring, so
 * nothing overshoots. `index` staggers list items 30ms apart.
 *
 * Reduced motion is handled by Reanimated itself for layout animations — it
 * drops entering/exiting animations when the OS setting is on.
 */
export function enterUp(index = 0) {
  return FadeInDown.duration(DUR.base)
    .easing(EASE_OUT)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })
    .delay(index * STAGGER_MS);
}

/** Entrance without movement, for backdrops and overlays. */
export function enterFade(index = 0) {
  return FadeIn.duration(DUR.base).easing(EASE_OUT).delay(index * STAGGER_MS);
}

/** Quick exit — must never exceed the fast budget. */
export function exitFade() {
  return FadeOut.duration(DUR.fast);
}
