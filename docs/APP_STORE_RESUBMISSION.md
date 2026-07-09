# App Store resubmission (rejection Jul 8, 2026)

## What changed in code

- **Microphone / speech purpose strings** — expanded in `app.config.ts` with examples (`flip`, `good`, `end`, etc.)
- **Support page** — `docs/support.md` → https://mcmahonjosh.github.io/AudioCards/support
- **In-app Support URL** — `app.config.ts` and `src/constants/urls.ts`

## Steps you must complete

### 1. Push to GitHub (if not already pushed)

```bash
git push origin main
```

Wait 1–2 minutes, then confirm this loads in a browser:

https://mcmahonjosh.github.io/AudioCards/support

### 2. Update App Store Connect metadata

**App Store Connect → Apps → Audio Cards → App Information**

- **Support URL:** `https://mcmahonjosh.github.io/AudioCards/support`

Save.

### 3. New production iOS build (required for purpose strings)

Purpose strings are baked into the binary. Build and submit:

```bash
npm run build:ios
```

When the build finishes:

```bash
npm run submit:ios
```

Or submit manually in App Store Connect → TestFlight → select the new build.

### 4. Attach build and resubmit

1. App Store Connect → your version **1.0**
2. Select the new build (build 9 or higher)
3. **Submit for Review**

### 5. Reply to App Review

In App Store Connect, reply to the rejection message:

> We updated the microphone and speech recognition purpose strings to explain hands-free voice commands with specific examples (e.g. "flip", "good", "end") and clarified that audio is processed on-device and not stored. We also replaced the Support URL with a dedicated support page at https://mcmahonjosh.github.io/AudioCards/support that includes contact information and a FAQ.
