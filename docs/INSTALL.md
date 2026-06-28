# Installation Guide

Complete step-by-step installation instructions for all supported platforms.

---

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | ≥ 18.x | Build tool, development server |
| npm | ≥ 9.x | Package manager |
| Git | Any | Clone the repository |
| Android Studio | Latest stable | Android APK builds only |
| JDK | 17 | Android APK builds only |

No API keys, environment variables, or paid accounts are required.

---

## 1. Clone the Repository

```bash
git clone https://github.com/yourusername/jobhunt.git
cd jobhunt
```

---

## 2. Install Dependencies

```bash
npm install
```

This installs:
- React 19 + react-dom
- react-scripts (CRA build toolchain)
- @capacitor/core, @capacitor/cli, @capacitor/android
- @capacitor/background-runner, @capacitor/local-notifications
- @testing-library suite

Expected output: a `node_modules/` directory (~300MB). This is excluded from Git.

---

## 3. Start the Development Server

```bash
npm start
```

Opens `http://localhost:3000` in your default browser.

The development server hot-reloads on file changes. API calls are made directly from the browser to the three external APIs — no proxy is configured.

---

## 4. Production Build

```bash
npm run build
```

Output: `build/` directory containing the optimized React bundle, ready to deploy.

---

## 5. Run Tests

```bash
npm test
```

Launches Jest in interactive watch mode. Press `a` to run all tests, `q` to quit.

---

## Android Setup

### Step 1 — Verify Java Version

```bash
java -version
# Should output: openjdk version "17.x.x" or later
```

If not installed, download from [adoptium.net](https://adoptium.net/).

### Step 2 — Install Android Studio

Download from [developer.android.com/studio](https://developer.android.com/studio).

During setup, select:
- Android SDK
- Android SDK Platform (API 36)
- Android Virtual Device

### Step 3 — Configure SDK Path

After Android Studio first launch, Android Studio sets `ANDROID_HOME` automatically. Verify:

```bash
# macOS / Linux
echo $ANDROID_HOME
# Should output something like: /Users/yourname/Library/Android/sdk

# Windows (PowerShell)
echo $env:ANDROID_HOME
# Should output something like: C:\Users\yourname\AppData\Local\Android\Sdk
```

If not set, add to your shell profile:
```bash
# macOS / Linux (~/.bashrc or ~/.zshrc)
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
```

### Step 4 — Build the React App

```bash
npm run build
```

### Step 5 — Sync into Android Project

```bash
npx cap sync android
```

This copies the `build/` output into `android/app/src/main/assets/public/` and compiles `capacitor.config.ts` into `android/app/src/main/assets/capacitor.config.json`.

### Step 6 — Open in Android Studio

```bash
npx cap open android
```

Android Studio opens with the project ready to build.

### Step 7 — Run on Device or Emulator

**Physical device:**
1. Enable Developer Options on your Android device (tap Build Number 7 times in Settings → About Phone)
2. Enable USB Debugging
3. Connect device via USB
4. In Android Studio: click ▶ Run or press `Shift+F10`

**Emulator:**
1. In Android Studio: **Tools → Device Manager → Create Device**
2. Select a device profile and API 24+ system image
3. Click ▶ Run

---

## Verify Installation

After starting `npm start`, confirm:

1. **Search tab loads** — you see the search input and three filter rows
2. **Search works** — type "developer", tap ⚡ Search Jobs — job results appear within 5 seconds
3. **Save works** — tap 📌 on a job card — it changes to 🔖
4. **Persistence works** — reload the page — the saved job is still in the Saved tab

For Android:
1. **App installs** — APK installs and launches with the correct name "JobHunt"
2. **Monitor permission** — Navigate to Monitor tab, tap Start Monitoring — OS shows notification permission prompt

---

## Troubleshooting

### `npm install` fails with permission errors (macOS/Linux)

```bash
# Fix npm global permissions
sudo chown -R $(whoami) ~/.npm
npm install
```

### `npm start` fails with "port 3000 is in use"

```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill -9

# Or start on a different port
PORT=3001 npm start
```

### Android Studio can't find the SDK

Open **File → Project Structure → SDK Location** and set the Android SDK path manually.

### `npx cap sync android` fails: "Cannot find module '@capacitor/cli'"

```bash
npm install
npx cap sync android
```

`@capacitor/cli` is a project dependency, not a global install. Run from inside the project directory.

### Jobs API returns no results

1. Check your internet connection
2. The APIs are public and free — verify they are reachable by opening `https://remotive.com/api/remote-jobs?search=developer&limit=5` in a browser tab
3. Try a broader search keyword (e.g., "engineer" instead of a very specific role)

### `npm run build` fails with `ENOMEM` (out of memory)

```bash
# Increase Node.js heap size
NODE_OPTIONS=--max_old_space_size=4096 npm run build
```
