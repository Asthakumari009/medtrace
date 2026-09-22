import { supabase } from "./supabase";

/**
 * Native Google Sign-In → Supabase session.
 *
 * The native module is require()d lazily (same pattern as src/lib/health):
 * inside Expo Go it doesn't exist, and without a configured web client id
 * there is nothing to sign in against — in both cases the Google button
 * simply doesn't render.
 */

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

type GoogleSigninModule = typeof import("@react-native-google-signin/google-signin");

function loadModule(): GoogleSigninModule | null {
  if (WEB_CLIENT_ID === undefined || WEB_CLIENT_ID === "") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@react-native-google-signin/google-signin") as GoogleSigninModule;
  } catch {
    return null; // Expo Go — native module not linked
  }
}

export function googleSignInAvailable(): boolean {
  return loadModule() !== null;
}

/**
 * Run the native account-picker flow and exchange Google's ID token for a
 * Supabase session. Resolves "cancelled" when the user backs out; throws on
 * real failures (no Play Services, misconfigured client, network).
 */
export async function signInWithGoogle(): Promise<"success" | "cancelled"> {
  const mod = loadModule();
  if (mod === null || WEB_CLIENT_ID === undefined) {
    throw new Error("Google Sign-In is not configured");
  }

  const { GoogleSignin } = mod;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  // Clear the locally-cached Google account first. Without this, signIn()
  // silently re-uses the last account and the chooser never appears, so the
  // user can't pick a different Gmail. signOut() only drops the native cache —
  // it doesn't touch the Supabase session.
  try {
    await GoogleSignin.signOut();
  } catch {
    // No cached account to clear — proceed straight to the picker.
  }

  const response = await GoogleSignin.signIn();
  if (response.type !== "success") return "cancelled";

  const idToken = response.data.idToken;
  if (idToken === null) throw new Error("Google returned no ID token");

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error !== null) throw new Error(error.message);
  return "success";
}
