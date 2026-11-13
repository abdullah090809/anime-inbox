# Anime Inbox

An Android app that turns screenshots of anime mentions (comment sections, captions) into a rated
anime list. Share a screenshot to the app, review what it found later, and export the list to your
notepad app.

**Status: written but never run on a phone.** The pure logic (title matching, picking candidates,
reading your watched list, building export lines) is tested here with node (`npm run test:logic`).
The screens and the native parts are untested, so expect a few things to need fixing on the first
build. Send the error text back and they get fixed.

## Two ways to run it (Expo SDK 58)

### A. Quick test in Expo Go (about 5 minutes, reduced features)

```bash
cd anime-inbox
npm install --legacy-peer-deps
npx expo install --fix        # lines every Expo package up with SDK 58
npx expo start
```

Scan the QR code with Expo Go (SDK 58). What works: the whole interface, **Import from gallery**,
manual **Pick text** and MyAnimeList search, lists, rating, watched-list import, export, scene search.
What does **not** work in Expo Go: automatic text reading and the silent **Share** target (both
need native code), and background processing may be unavailable. Use it to check the look and flow.

### B. Full app (development build, everything works)

Needs Node.js 20+, JDK 17, Android Studio (Android SDK) and a phone with USB debugging, or an emulator.

```bash
cd anime-inbox
npm install --legacy-peer-deps
npx expo install --fix
npx expo prebuild --platform android --clean
npx expo run:android          # builds and installs on the connected phone
```

After the first install you can run `npx expo start --dev-client` and open the app.

**No Android Studio?** Use the cloud build instead (free EAS account, queue times vary):

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform android
```

### C. Build the APK on GitHub (no Android Studio needed)

1. Put the project in a GitHub repository (private is fine) on the `main` branch.
2. Open the repo's **Actions** tab, choose **Build Android APK**, press **Run workflow**.
3. After about 10-20 minutes, open the finished run and download **anime-inbox-apk** (a zip with the .apk).
4. Copy the .apk to your phone and install it (allow "install unknown apps" when asked).

This is a standalone app: it does not need your computer running. The APK is signed with a debug key,
fine for your own phone. If a build fails, open the failed step in the run and send me the red error text.

### If the build fails

Copy the error and send it to me. The two places most likely to need a tweak:

1. `@infinitered/react-native-mlkit-text-recognition` (reads text on the phone). It is set to
   `latest`; if it conflicts, pin the version it suggests. The app still starts without it and
   falls back to manual "pick text".
2. `plugins/withQuickShare.js` (the silent share target). To switch it off, remove the line
   `"plugins": ["./plugins/withQuickShare"]` from `app.json` and rebuild. You can still use
   **Import from gallery**.

## How to use it

1. Take a screenshot. Tap **Share**, choose **Anime Inbox**. A short "Saved" message appears and
   the app stays closed. (Its own copy is saved straight away, so it doesn't matter if your phone
   deletes the original.)
2. Open the app. The **Inbox** shows each screenshot with what was found.
3. Tap one to **Review**:
   - **Results**: tick the right anime. Strong matches are pre-ticked. Warnings show if it's already
     in your list or already on your watched list.
   - **Pick text**: tap the words in the screenshot, edit the name, search MyAnimeList (or open
     Google).
   - **Scene**: drag a box over the video and identify the scene.
   - **Add to <list>** saves it. The app's copy of the screenshot is then deleted. Your gallery
     original is never touched.
4. **Lists** tab: your lists (default **Anime Watch List**), your rating, move or delete anime.
   Import your old watched list under **Watched**.
5. **Export to notepad**: choose what to include, then **Copy** or **Share .txt**.
   Lines look like `1. Baka & Test: Summon the Beasts (MAL 7.5/10) – Comedy, Romance`.

The Inbox also has an **Import from gallery** button (top right) for screenshots you already have.

## Things to know

- **Background processing is slow by design.** Android only lets the app run in the background about
  every 15 minutes at best. Anything left is processed the moment you open the app.
- **Scene search (trace.moe) has a small free limit** (about 100 searches a month when this was
  written, shared with other people on the same network). The app counts its use in Settings and
  lets you add your own key.
- **MyAnimeList (Jikan) allows about 1 request per second**, so matching a 400-title watched list
  takes roughly 7 minutes. Keep the screen on; it can be stopped and resumed.
- **Notifications** need permission on Android 13 and newer. The app asks only when you turn the
  setting on.
- Adult titles are hidden from search results unless you turn them on in Settings.

## Project map

```
App.tsx, index.ts            app shell, tabs, background task registration
plugins/withQuickShare.js    Android share target that doesn't open the app
src/services/                matching, text reading, MyAnimeList, trace.moe, queue, export
src/screens/                 Inbox, Review, Lists, List detail, Export, Watched, Settings
src/ui/ , src/theme.ts       design tokens and components (dark and light)
SPEC.md                      every design decision, for continuing in any tool
tests/logic.test.js          node tests for the pure logic
```
