# On-device development loop — vivo iQOO

The demo device is the measured device. Everything below runs against the real phone;
an emulator does not count and is not used.

Nothing in this file is app code. It is the workflow, and it is measured from device
data over time — so start using it now, not on the last day.

## 1. vivo Office Kit (multi-screen collaboration)

On the iQOO (OriginOS): **Settings → Office Kit / Multi-Screen Collaboration** → pair
with the Windows machine on the same Wi-Fi. That gives three things this project uses
daily:

- **Screen mirroring** — the phone's screen on the laptop, for building and for
  recording the demo without pointing a camera at a handset.
- **File transfer** — pull report photos onto the phone to test the camera path, and
  pull screenshots and `framestats` dumps back off it.
- **Shared clipboard** — paste one-time share links and Supabase tokens between the two
  without retyping them.

## 2. Wireless debugging

1. **Settings → About phone → Software version**, tap 7× to unlock Developer options.
2. **Developer options → USB debugging** on, then **Wireless debugging** on.
3. Pair once, from *Wireless debugging → Pair device with pairing code*:
   ```
   adb pair <phone-ip>:<pair-port>     # enter the 6-digit code shown
   adb connect <phone-ip>:<debug-port> # the port under "IP address & Port"
   adb devices                         # confirm the iQOO is listed
   ```
4. The pairing survives reboots on the same network; only `adb connect` is needed again.

## 3. Build and run on the device

The app needs a dev client, not Expo Go — Google Sign-In, SecureStore, and ML Kit text
recognition are all native modules.

```
npx expo prebuild --platform android --template expo-template-bare-minimum@57.0.26
npx expo run:android --device          # installs the dev client on the iQOO
npm run dev:device                     # expo start --dev-client, reloads over Wi-Fi
```

## 4. Everything else, over the same connection

| What | Command |
|---|---|
| JS logs | `npm run logs:device` |
| Frame timing | `npm run perf:device` |
| Screenshot for the deck | `npm run shot:device` → `artifacts/device-shot.png` |
| Cold start | `adb shell am start -W -n com.vita.health/.MainActivity` |
| App size | `adb shell pm path com.vita.health`, then `adb shell du -h <apk>` |

`com.vita.health` is the package name and it is **not** being renamed — it is baked into
the Google OAuth client. See `docs/SCOPE.md`.

## 5. Verifying the on-device read, on the device

The privacy claim is only worth making if it can be checked live:

1. `npm run logs:device` in one terminal.
2. Add a report by **photo**. The result sheet must say *"Read on your phone"*.
3. Confirm no upload happened — nothing appears under `<uid>/` in the Supabase
   `reports` bucket for that report, and the row's `extraction_source` is
   `on_device_ocr` with `file_path` null.
4. Add a **PDF**. It must say *"Read in the cloud"* — that is the honest boundary,
   because ML Kit cannot read PDFs.
5. Settings → **You** shows *"Reports are read on this phone"* only when the native
   module is actually in the build. In Expo Go or on the web it falls back silently to
   the cloud path and the copy changes with it.
