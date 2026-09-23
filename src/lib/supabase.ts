import "react-native-url-polyfill/auto";

import { privateStorage } from "./privateStorage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

import { type Database } from "./database.types";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing Supabase config. Copy .env.example to .env, fill in " +
      "EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart " +
      "the dev server with `npx expo start --clear`.",
  );
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    storage: privateStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Web Google sign-in returns here with ?code=… (googleAuth.web.ts).
    // Native never receives an OAuth redirect, so it keeps this off.
    detectSessionInUrl: Platform.OS === "web",
    flowType: Platform.OS === "web" ? "pkce" : "implicit",
  },
});

// Refresh tokens only while the app is foregrounded (Supabase RN guidance).
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
