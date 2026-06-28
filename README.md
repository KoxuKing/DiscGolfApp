# Disc Golf Training

Mobile-first React + TypeScript PWA for tracking disc golf training sessions.

## Development

```bash
npm install
npm run dev
```

## Checks

```bash
npm run test:run
npm run build
```

## Android Test Build

The Android wrapper is built with Capacitor. Generated APKs and local Android/JDK tools are not committed.

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

The generated debug APK is created under `android/app/build/outputs/apk/debug/`.
