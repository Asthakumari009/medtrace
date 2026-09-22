# Deploying MedTrace to Vercel

One deployment serves two things: the Expo web export (static) and the FastAPI service
(one Python function). `vercel.ts` wires the split — see the comment at the top of it.

The stale `vita-api` link has been removed from `.vercel/`, so the first `vercel link`
below creates a fresh project.

## 0. Log in (interactive — must be done by hand)

```
vercel login
vercel whoami        # must print your account, not "Error: Not authorized"
```

## 1. Link a new project

```
vercel link --yes --project medtrace
```

## 2. Environment variables

Two groups. The `EXPO_PUBLIC_*` ones are read at **build** time and compiled into the
web bundle — they are public by design. The rest are read at **runtime** by the Python
function and must never appear in an `EXPO_PUBLIC_*` name.

```
# --- build time (web export) ---
vercel env add EXPO_PUBLIC_SUPABASE_URL           production   # https://sjwupugbajrtegjgnxba.supabase.co
vercel env add EXPO_PUBLIC_SUPABASE_ANON_KEY      production   # sb_publishable_... (from .env)
vercel env add EXPO_PUBLIC_API_URL                production   # https://medtrace.vercel.app  (see step 4)
vercel env add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID   production   # from .env

# --- runtime (FastAPI) ---
vercel env add SUPABASE_URL          production   # https://sjwupugbajrtegjgnxba.supabase.co
vercel env add SUPABASE_SECRET_KEY   production   # Medtrace project -> Settings -> API keys -> secret
vercel env add GOOGLE_CLOUD_PROJECT  production   # from api/.env
vercel env add GOOGLE_CLOUD_LOCATION production   # global
vercel env add GEMINI_MODEL          production   # gemini-2.5-flash
vercel env add VITA_ALLOWED_ORIGINS  production   # https://medtrace.vercel.app
vercel env add GOOGLE_SA_JSON        production   # paste the ENTIRE contents of api/sa-vertex.json
```

Two traps here:

- **`GOOGLE_SA_JSON`, not `GOOGLE_APPLICATION_CREDENTIALS`.** There is no credentials
  file on a serverless host. `api/main.py` writes `GOOGLE_SA_JSON` into the temp dir and
  points google-auth at it — but only when `GOOGLE_APPLICATION_CREDENTIALS` is *unset*.
  If you set both, the file path wins, the file does not exist, and every Gemini call
  fails. Set `GOOGLE_SA_JSON` alone.
- **`VITA_ALLOWED_ORIGINS` keeps its old name** on purpose. It is deployment identity;
  renaming it silently drops the configured CORS origins. See `docs/SCOPE.md`.

## 3. Deploy

```
vercel --prod
```

## 4. Point the app at the new URL

`EXPO_PUBLIC_API_URL` is inlined at build time (`src/lib/http.ts`), so it is baked into
both the web bundle and the Android binary.

1. Note the production URL that step 3 prints.
2. Set it as `EXPO_PUBLIC_API_URL` in Vercel (step 2) **and** in local `.env`.
3. Redeploy so the web bundle picks it up: `vercel --prod`.
4. Rebuild the Android app — the old APK still points at the previous URL.

## 5. Verify

```
curl -s https://<your-url>/health
```

Expect `{"status":"ok","config":{"supabase":true,"vertex":true}}`. Both booleans must be
`true`; they are presence checks only and never echo a value. `supabase:false` means the
two Supabase vars are missing, `vertex:false` means the Google credential is.

Then check the split is actually working:

```
curl -s -o /dev/null -w '%{http_code}\n' https://<your-url>/           # 200, the web app
curl -s -o /dev/null -w '%{http_code}\n' https://<your-url>/health     # 200, the function
curl -s -o /dev/null -w '%{http_code}\n' https://<your-url>/extract    # 401, needs a bearer token
```

If `/` returns the API's 404 JSON instead of the web app, `.vercelignore` or the
`buildCommand` is wrong — the old `.vercelignore` was an allowlist that uploaded only
`/api`, which is why the web export was never served.

## Pre-deploy gate

```
npm run typecheck && npm test && npm run test:api && npm run test:e2e
npm run export:web        # must succeed; this is what Vercel runs
```

`npm run check:release` is a separate gate for store builds, not for Vercel.
