import { routes, type VercelConfig } from "@vercel/config/v1";

/**
 * Two things ship from this repo: the Expo web export (static) and the FastAPI
 * service (one Python function).
 *
 * The previous vercel.json rewrote **every** path to the function, so the web
 * export was never served at all. Here the function keeps exactly the paths it
 * already answers — the mobile app's EXPO_PUBLIC_API_URL points at the root, so
 * moving the API under /api/* would break every installed build — and
 * everything else falls through to the static export.
 */

/** Paths served by FastAPI (api/main.py + api/sharing.py). */
const API_PATHS = [
  "/health",
  "/chat",
  "/voice",
  "/extract",
  "/shares",
  "/share/(.*)",
  "/doctor-assets/(.*)",
];

export const config: VercelConfig = {
  buildCommand: "npx expo export --platform web --output-dir dist",
  outputDirectory: "dist",
  framework: null,

  functions: {
    "api/index.py": {
      // The doctor view is served as files from inside the function.
      includeFiles: "api/doctor-web/**",
      // Extraction runs a long Gemini call on a whole document.
      maxDuration: 60,
      memory: 1024,
    },
  },

  rewrites: [
    ...API_PATHS.map((path) => routes.rewrite(path, "/api/index")),
    // Expo Router web is a single-page app: any remaining path is a client
    // route. Vercel serves real static files before reaching this.
    routes.rewrite("/(.*)", "/index.html"),
  ],

  headers: [
    // Hashed bundles and fonts never change under the same URL.
    routes.cacheControl("/_expo/static/(.*)", {
      public: true,
      maxAge: "1 year",
      immutable: true,
    }),
    // Medical data and one-time share links must never be cached anywhere.
    {
      source: "/(health|chat|voice|extract|shares)",
      headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
    },
    {
      source: "/share/(.*)",
      headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
    },
  ],
};

export default config;
