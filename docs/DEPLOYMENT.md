# Deployment Guide

JobHunt deploys to two targets from the same source: Vercel (web PWA) and Android Studio (APK). This guide covers both.

---

## Table of Contents

- [Web Deployment (Vercel)](#web-deployment-vercel)
  - [Automatic via GitHub](#automatic-via-github)
  - [Manual via CLI](#manual-via-cli)
  - [Vercel Configuration](#vercel-configuration)
  - [Security Headers Explained](#security-headers-explained)
- [Android APK Build](#android-apk-build)
  - [Prerequisites](#prerequisites)
  - [Debug Build](#debug-build)
  - [Release Build (Signed)](#release-build-signed)
  - [Updating the Bundled APK](#updating-the-bundled-apk)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Troubleshooting](#troubleshooting)

---

## Web Deployment (Vercel)

### Automatic via GitHub

1. Push the repository to GitHub
2. Go to [vercel.com](https://vercel.com) → Import Project → select the repository
3. Vercel reads `vercel.json` automatically — no manual configuration needed
4. Every push to `main` triggers a production deployment

### Manual via CLI

```bash
# Install Vercel CLI globally (once)
npm install -g vercel

# Build the production bundle
npm run build

# Deploy to production
vercel --prod
```

### Vercel Configuration

`vercel.json` in the root configures:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [...]
}
```

The `rewrites` rule is critical for the PWA — all URL paths serve `index.html`, letting the React app handle navigation client-side.

### Security Headers Explained

| Header | Value | Why |
|--------|-------|-----|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Enforces HTTPS for 1 year, including subdomains; eligible for HSTS preload list |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing attacks |
| `X-Frame-Options` | `DENY` | Prevents the app from being embedded in an iframe (clickjacking protection) |
| `X-XSS-Protection` | `1; mode=block` | Legacy header; instructs older browsers to block detected XSS |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Sends full referrer for same-origin requests, only origin for cross-origin |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Explicitly blocks access to sensitive browser APIs not used by the app |
| `Content-Security-Policy` | (see below) | Controls which resources the browser may load |
| `Cross-Origin-Opener-Policy` | `same-origin` | Prevents cross-origin windows from accessing this window's context |
| `Cross-Origin-Resource-Policy` | `same-origin` | Prevents cross-origin pages from reading this page's resources |

**Full CSP value:**
```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
connect-src 'self' https://remotive.com https://www.arbeitnow.com https://www.themuse.com;
img-src 'self' data: https:;
font-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

> **Note:** `'unsafe-inline'` in `script-src` and `style-src` is required by Create React App's runtime chunk and inline style injection. This is a known limitation of the CRA build system.

---

## Android APK Build

### Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Android Studio | Latest stable | [developer.android.com](https://developer.android.com/studio) |
| JDK | 17 | Bundled with Android Studio |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |

### Debug Build

A debug build is fastest for testing on a device or emulator.

```bash
# Step 1 — Build the React web app
npm run build

# Step 2 — Sync the web build into the Android project
npx cap sync android

# Step 3 — Open Android Studio
npx cap open android
```

In Android Studio:
- Click **Run** (▶) or press `Shift+F10`
- Select a connected device or emulator
- The debug APK is installed directly to the device

Alternatively, build from the command line:

```bash
cd android
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

### Release Build (Signed)

Play Store and sideloading require a signed release APK.

#### Step 1 — Create a keystore (first time only)

```bash
keytool -genkey -v \
  -keystore jobhunt-release.jks \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias jobhunt
```

Store `jobhunt-release.jks` securely. **Do not commit it to Git.**

#### Step 2 — Configure signing in Gradle

Add to `android/app/build.gradle`:

```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file("../../jobhunt-release.jks")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias "jobhunt"
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            ...
            signingConfig signingConfigs.release
        }
    }
}
```

Using environment variables keeps credentials out of source code.

#### Step 3 — Build the signed APK

```bash
cd android

# Set environment variables for the build session
export KEYSTORE_PASSWORD=your_keystore_password
export KEY_PASSWORD=your_key_password

./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

#### Step 4 — Verify the signature

```bash
apksigner verify --verbose android/app/build/outputs/apk/release/app-release.apk
```

#### Via Android Studio

- **Build → Generate Signed Bundle / APK**
- Select **APK**
- Choose the keystore, fill in passwords and alias
- Select **release** build variant
- Click **Finish**

### Updating the Bundled APK

The PWA serves the APK at `/cyberhunt.apk` for Android browser users who want to install natively. To update it:

```bash
# 1. Build the new signed release APK (see above)
# 2. Copy it to the public folder
cp android/app/build/outputs/apk/release/app-release.apk public/cyberhunt.apk

# 3. Rebuild the web app (so the new APK is included in the build output)
npm run build

# 4. Deploy to Vercel
vercel --prod
```

---

## Android Build Configuration

### Version numbers

Edit `android/app/build.gradle`:

```gradle
defaultConfig {
    ...
    versionCode 2        // Increment for every Play Store release
    versionName "0.2.0"  // Human-readable version string
}
```

### SDK versions (android/variables.gradle)

```gradle
ext {
    minSdkVersion = 24    // Android 7.0 — ~97% of devices as of 2026
    compileSdkVersion = 36
    targetSdkVersion = 36
}
```

### ProGuard (Release builds)

ProGuard is enabled for release builds in `android/app/build.gradle`:

```gradle
release {
    minifyEnabled true
    shrinkResources true
    proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
}
```

`android/app/proguard-rules.pro` is currently empty (Capacitor's own rules are applied automatically via the AAR dependencies).

---

## Pre-Deployment Checklist

### Before every web deployment

- [ ] `npm run build` completes without errors or warnings
- [ ] `npm test` passes
- [ ] App loads and searches correctly in a local build (`npx serve -s build`)
- [ ] All three API sources return results
- [ ] Save/unsave persists on page reload
- [ ] Monitor tab shows the correct keyword

### Before every APK release

- [ ] `versionCode` incremented in `build.gradle`
- [ ] `versionName` updated to match the new release version
- [ ] `npm run build` → `npx cap sync android` completed
- [ ] Debug APK tested on a physical Android device
- [ ] Push notifications work (enable monitor → wait 30 min or manually trigger)
- [ ] APK signed with the release keystore
- [ ] Signature verified with `apksigner verify`
- [ ] `public/cyberhunt.apk` updated with the new signed APK
- [ ] Web deployment updated with the new APK

---

## Troubleshooting

### `npx cap sync android` fails

```
Error: Capacitor project not found
```
Ensure you are running the command from the project root (where `capacitor.config.ts` is located).

---

### Android build fails: `JAVA_HOME not set`

```bash
# macOS / Linux
export JAVA_HOME=$(/usr/libexec/java_home -v 17)

# Windows (PowerShell)
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
```

Or set it permanently in Android Studio under **File → Project Structure → SDK Location → JDK Location**.

---

### App shows blank screen on Android

1. Run `npx cap sync android` after `npm run build` — the web assets in `android/app/src/main/assets/public/` may be stale
2. Check that `capacitor.config.ts` → `webDir` is set to `"build"` (the Create React App output folder)
3. Enable debug logging: in Android Studio → Logcat, filter by `Capacitor`

---

### Push notifications not received

1. Check that the app has notification permission: Android Settings → Apps → JobHunt → Notifications → Enable
2. Battery optimization may kill background tasks: Android Settings → Battery → JobHunt → Unrestricted
3. WorkManager jobs are subject to Doze mode; notifications may be delayed up to 15 minutes by the OS

---

### Vercel deployment shows "React App" title

The HTML template `public/index.html` title was updated to "JobHunt — Multi-Platform Job Search" in v0.2.0. If you see the old title, your deployed build is from an older commit. Redeploy from the current `main` branch.
