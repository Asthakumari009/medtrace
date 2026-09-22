# Setting up sign-in

MedTrace has two sign-in paths and **both were broken** until this was written,
in four separate places. Work through it in order; each step says how to prove
it worked, because every one of these fails silently in a way that looks like
"the app is buggy".

Project: `sjwupugbajrtegjgnxba` · Package: `com.vita.health`

---

## The app's model (read this first, it explains the settings)

- **Google** uses the *native* flow, not an OAuth redirect. The phone gets an
  **ID token** from Google Play Services and hands it to
  `supabase.auth.signInWithIdToken()`. Nothing is redirected anywhere, so no
  callback URL is involved (`src/lib/googleAuth.ts`).
- **Email** uses a **numeric code**, not a magic link.
  `signInWithOtp()` sends it, `verifyOtp({ type: "email" })` checks it
  (`app/(auth)/email.tsx`, `app/(auth)/verify.tsx`).

Both of those differ from Supabase's defaults, which is why the defaults break.

---

## 1. Google Cloud Console — two clients, not one

<https://console.cloud.google.com/apis/credentials> (project `bytesofjoy-501900`).

Configure the **OAuth consent screen** first (External; app name `MedTrace`;
your address for support and developer contact). While it is in *Testing*, add
every Google account you will demo with under **Test users** — an account that
is not listed is rejected at the picker.

Then create **two** OAuth client IDs. You need both, and they do different jobs:

| Type | Why |
| --- | --- |
| **Android** | Lets Play Services issue a token to *this* app. Not sent anywhere. |
| **Web** | The token's `aud`. This is the one the app and Supabase both use. |

**Android client** — Package name `com.vita.health`, SHA-1:

```
5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

That is the **debug** keystore (`android/app/debug.keystore`), because
`android/app/build.gradle` signs release with `signingConfigs.debug`. It is a
shared, publicly known key — fine for a prototype, never for the Play Store.
Re-check it after changing signing:

```
keytool -list -v -keystore android/app/debug.keystore \
        -alias androiddebugkey -storepass android
```

**Web client** — no redirect URIs needed for the phone. Copy its client ID into
`.env` as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (already set: `720215…`). It is
compiled into the binary, so **changing it means rebuilding the APK**.

> Never put the *Android* client ID in `.env`. `GoogleSignin.configure()` takes
> `webClientId`; the Android one yields a token Supabase will not accept.

---

## 2. Supabase — enable Google

**Authentication → Sign In / Providers → Google.**

1. Toggle **Enable Sign in with Google** on.
2. **Client ID** → the **Web** client ID.
3. **Authorized Client IDs** → the **same Web client ID**.

Step 3 is the one people miss. It is the allowlist the *native* ID-token flow
checks. Leave it empty and the provider still reports as enabled while every
phone sign-in fails.

Prove it — this must **not** say `provider_disabled`:

```
curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=id_token" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"provider":"google","id_token":"dummy"}'
```

Before: `{"code":400,"error_code":"provider_disabled",...}`
After: a complaint about the *token* being malformed — that means the provider
is live and only the dummy token is bad.

---

## 3. Supabase — make the email carry a code, not a link

**Authentication → Emails → Templates → Magic Link.**

The default body is a link (`{{ .ConfirmationURL }}`). The app asks for a code,
so a user who follows the link lands on the **Site URL** — by default
`localhost:3000`, which on a phone is nothing at all. Replace the body with the
token:

```html
<h2>Your MedTrace sign-in code</h2>
<p>Enter this code in the app. It expires shortly and can be used once.</p>
<p style="font-size:28px;letter-spacing:4px"><b>{{ .Token }}</b></p>
```

`{{ .Token }}` is the same code `verifyOtp` accepts. Keep the link out entirely
— two ways in is two ways to confuse a judge mid-demo.

---

## 4. Supabase — make the code length match the app

**Authentication → Sign In / Providers → Email → OTP Length.**

This project issues **8**, and `app/(auth)/verify.tsx` submits the moment it has
`CODE_LENGTH` digits. With the two out of step the app posts a truncated code
and Supabase answers `otp_expired`, which reads like an expiry problem and is
not one.

Pick one and make the other match:

- Leave Supabase at **8** — `CODE_LENGTH = 8` (current setting), or
- Set Supabase to **6** — then set `CODE_LENGTH = 6` and change `emailSub` back
  to "six-digit" in all three locales.

Changing the app side means **rebuilding the APK**.

---

## 5. URL configuration

**Authentication → URL Configuration → Site URL:**

```
https://medtrace-asthakumari009s-projects.vercel.app
```

Not `localhost:3000`. The phone never redirects, so this only affects links in
emails — but a stale value is what produced `ERR_CONNECTION_REFUSED` on the
sign-in link.

---

## Verifying end to end

```
python api/dev_otp.py you@example.com     # prints a code, sends no email
```

`dev_otp.py` uses the service-role key to mint the same code the email carries,
which sidesteps Supabase's built-in SMTP limit of a few messages per hour.
It mints a code for **any** account — never deploy or expose it.

Then, on the phone: Continue with Google should reach the account picker and
land on the dashboard; Continue with email should accept the printed code.

Watch for these, each of which means something specific:

| Symptom | Cause |
| --- | --- |
| `DEVELOPER_ERROR` / code 10 at the picker | SHA-1 or package mismatch on the **Android** client (step 1) |
| Picker opens, then "sign-in didn't complete" | Google provider off, or Web client ID missing from **Authorized Client IDs** (step 2) |
| Email arrives as a link | Template still `{{ .ConfirmationURL }}` (step 3) |
| Link opens `localhost:3000` | Site URL unset (step 5) |
| Code rejected as expired straight away | Length mismatch (step 4) |
| "Rate limit exceeded" sending | Built-in SMTP cap — use `dev_otp.py` |

`app/(auth)/welcome.tsx` swallows the underlying error and shows one generic
line, so the table above is faster than the logs. `adb logcat` will not tell
you more.
