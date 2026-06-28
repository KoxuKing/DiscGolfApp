# Disc Golf Training

Mobile-first React + TypeScript training tracker for disc golf. The app stores sessions, discs, and draft data locally in the browser or Android WebView storage.

## Features

- Create one training session at a time for putting, approaches, midranges, or forehand.
- Configure distance, throw count, date, wind, fatigue, and notes.
- Track each throw with optional disc, score/proximity, direction, release issue, putting result, and error details.
- Continue the same session with the previous throw's disc preselected.
- Save session history with scores, average distance, most common session parameter, and notes.
- Manage a local disc list by name and category.
- Export history as JSON for AI analysis.
- Run as a PWA in the browser or as an Android test APK through Capacitor.

## Requirements

- Node.js 18+ for the web app.
- npm.
- For Android APK builds: JDK 21 and Android SDK command-line tools.

This project includes Capacitor dependencies, but generated build output, local Android SDK/JDK downloads, APK files, and `node_modules` are intentionally not committed.

## First Setup

From the project folder:

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Vite starts a local development server. Open the URL shown in the terminal, usually:

```text
http://localhost:5173/
```

## Test On Phone Over Local Network

1. Make sure the phone and computer are on the same Wi-Fi network.
2. Start the dev server:

```bash
npm run dev
```

3. Find the computer's local IP address:

```powershell
ipconfig
```

4. On the phone, open:

```text
http://YOUR-PC-IP:5173/
```

Example:

```text
http://192.168.32.175:5173/
```

If the phone cannot connect, allow Node.js/Vite through Windows Firewall for private networks.

## Run Checks

```bash
npm run test:run
npm run build
npm audit --audit-level=moderate
```

## Build Web Production Files

```bash
npm run build
```

The production web build is created in:

```text
dist/
```

## Android Test APK

The native Android wrapper is managed by Capacitor.

Build the web app and sync it into Android:

```bash
npm run build
npx cap sync android
```

Then build a debug APK:

```bash
cd android
gradlew.bat assembleDebug
```

The generated APK is created at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

For a convenient downloadable copy, copy it to:

```text
mobile-release/DiscGolfTraining-test-debug.apk
```

`mobile-release/` is ignored by Git.

## Install APK On Android

1. Copy or download the APK to the phone.
2. Open the APK file on the phone.
3. Allow "Install unknown apps" if Android asks.
4. Install and open `Disc Golf Training`.

This is a debug/test build, not a Play Store release.

## Git Workflow

Check current status:

```bash
git status -sb
```

Commit changes:

```bash
git add -A
git commit -m "Describe the change"
```

Push to GitHub after creating or connecting a remote:

```bash
git push -u origin main
```

## GitHub Setup

If GitHub CLI is installed and authenticated:

```bash
gh auth login
gh repo create FrisbeeGolf --private --source . --remote origin --push
```

If creating the GitHub repo manually:

```bash
git remote add origin https://github.com/YOUR_USERNAME/FrisbeeGolf.git
git push -u origin main
```

## Local Data

App data is stored locally on the device:

- Browser/PWA data is in browser storage.
- Android app data is in the app WebView storage.

Deleting browser site data or uninstalling the Android app can remove saved sessions and discs. Use `History -> Copy AI data` or `Export JSON` before clearing data.
