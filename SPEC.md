# Anime Inbox - design decisions

Android-only React Native (Expo SDK 58; development build for all features, Expo Go for a reduced test). Written from a long design discussion;
every item below was decided by the owner.

## Purpose
Screenshots of anime mentions (YouTube, TikTok, Facebook, Instagram comment sections or captions)
pile up. The app turns them into a rated anime list and exports that list to the owner's own
notepad app.

## Getting screenshots in
- **Share target ("Anime Inbox")**: silent. It must not open the app. It copies the image to the
  app's private folder, shows a short "Saved" toast (switchable off) and closes. Only screenshots
  the owner chooses to share go in.
- **Import from gallery**: multi-select; the app copies the files. Imports never delete originals.
- The phone may auto-delete a screenshot after sharing; that is why the app copies it immediately.

## Processing
1. Read text on the phone (ML Kit). Drop interface text, rank likely titles.
2. Look candidates up on MyAnimeList (Jikan), fuzzy-match (OCR typos allowed; a short title must not
   match a longer one, e.g. "Shadow" vs "The Eminence in Shadow").
3. Only if no name is found: identify the video scene with trace.moe (automatic last resort, can be
   switched off; also available manually in review by drawing a box).
- Processing runs when the app opens and, best effort, in a background task (about every 15 min at
  best). Optional batch notification "N screenshots are ready to review" (separate switch).

## Review (nothing is added without the owner's approval)
- Checklist of found anime with poster, English + Japanese name, MAL score, genres, confidence.
  Only the best result of each query is pre-ticked.
- Manual **pick text**: tap words in the screenshot, edit the name, search MyAnimeList; **Google**
  button opens the browser for the owner to look it up.
- Manual **identify scene**: drag a box over the video, send the crop to trace.moe.
- Warnings: "Already in <list>" (match by MyAnimeList ID) and "Watched - 4.5/5".
- **Not anime** removes the app's copy of the screenshot.
- On approve, only the app's own copy is deleted. The gallery original is never deleted by the app.
- A small thumbnail can be kept with each entry (setting, on by default).

## Lists and data
- Owner's own lists; default list is named **Anime Watch List**.
- Each entry: English + Japanese name, MAL score, genres, poster, year, episodes, own rating (0-5),
  optional thumbnail, exported flag.
- Duplicates are detected by MyAnimeList ID, not by text.
- **Watched list**: import a .txt (`1. Name (4.5/5)`), match each title to MyAnimeList (stores the
  ID), keep the owner's own rating. Can be imported again later: only new titles are added.

## Export to the owner's notepad app
- Copy, or share as a .txt file. Choose which entries (per list, "only not exported yet", tick
  individual ones) and which fields (English, Japanese, rating, genres, year, episodes, link).
- Default layout matches the owner's watched list: one line per anime, numbered from 1:
  `1. Baka & Test: Summon the Beasts (MAL 7.5/10) – Comedy, Romance`
- Rating bracket: the owner's own rating `(4.5/5)` if set, otherwise the labelled MAL score
  `(MAL 7.5/10)`.
- Options: start numbering at N, separator (dash, pipe, comma), most genres to show.
- Long lines simply wrap in the notepad (no hard line break inside an entry).

## Design
iOS-style principles applied on Android: tab bar with three tabs (Inbox, Lists, Settings), large
titles, 48 dp touch targets, safe areas, bottom sheets for focused tasks, dark and light themes
with one accent colour, empty/loading/error states, permissions requested only when the feature is
turned on and after an explanation. Text follows the phone's font size.
Not based on real example flows (no UXKIN connection was used).

## Known limits
- Not run on a device yet.
- trace.moe free tier is small; Jikan allows about 1 request per second.
- Background work timing is decided by Android.
