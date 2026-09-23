import { supabase } from "./supabase";

/**
 * Web Google Sign-In → Supabase session.
 *
 * The native module (googleAuth.ts) has no web implementation, so on web every
 * attempt threw and the welcome screen showed "didn't complete". The browser
 * uses Supabase's OAuth redirect instead: Google → Supabase callback → back
 * here with a PKCE code, which the client exchanges (detectSessionInUrl).
 *
 * Needs, outside the code: the Web client's secret in Supabase's Google
 * provider, this origin in Supabase's Redirect URLs, and
 * https://<ref>.supabase.co/auth/v1/callback on the Web client in Google Cloud.
 */

export function googleSignInAvailable(): boolean {
  return true;
}

export async function signInWithGoogle(): Promise<"success" | "cancelled"> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error !== null) throw new Error(error.message);
  // The page is navigating to Google; the session arrives on return.
  return "success";
}
