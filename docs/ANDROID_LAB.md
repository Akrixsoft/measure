# Measure Lab Android shell

- Package: `ge.akrix.measure.lab`; independent of installed `ge.akrix.measure`.
- Native launcher offers original v81 and experimental version. Both full HTML apps and relative assets are bundled in the APK and work without a hosting service.
- `https://v81.measure-lab.local/index.html` and `https://experimental.measure-lab.local/index.html` are intercepted by `WebViewClient` and served only from their own asset directories. Origins have separate IndexedDB and localStorage; no production URL is loaded or restored.
- Native top bar `Версии`, Android Back and `AkrixLab.chooseVersion()` run the same save path. It waits for `PM.flushAll`, `PM.saveNow`, then an explicit IndexedDB readwrite transaction committing the current session/room; failures leave the user in the current version. Switching disconnects BLE and destroys the WebView before returning to the launcher.
- Native `AkrixBT` and `AkrixApp` bridges remain available only to trusted bundled pages. External navigation opens in an external browser after confirmation, never in the privileged WebView. A CSP prevents remote scripts, frames and objects. No file:// access or cross-file universal access is enabled.
- JSON backup/restore uses the MIME/accept types requested by the page, instead of forcing image/*.
- Camera uses an internal cache `ContentProvider` with explicit temporary read/write URI grants. JSON sharing also uses content:// URIs, including on Android 8/9. Android 10+ exports additionally persist into `Downloads/Measure Lab`.
- APK minimum Android 8 (API26), target/compile API34.

## Build

Run `python scripts/build_apk.py` in this workspace with a JDK17, Gradle8.7 and Android SDK34 installed. The script defaults to ignored local `tools/` installations and accepts `JAVA_HOME`, `ANDROID_HOME`, `MEASURE_GRADLE` overrides. It stages the current `web/experimental.html` and all `web/lab-*.js/css` files alongside unchanged `web/v81.html`, checking the original v81 SHA256. Shared icon/manifest/marker assets from `web/shared` are copied to both directories.

The signing identity is generated once in ignored `.signing/` and reused. Keep that directory privately for later APK updates. Password and keystore contents are never committed or printed. Output is `artifacts/measure-lab-v81-test.apk` plus a SHA256 file; the script invokes `apksigner verify` after signing. This is a separate test signing identity, not the production signing key.

## Validation boundary

Successful compilation/signature/asset checks establish APK packaging, not physical-device behavior. Camera permissions, Android lifecycle on the owner's phone, Bluetooth GLM communication and constructor handoff still require device testing. Baseline v81 is unchanged; known baseline defects remain reproducible in that version for comparison.
