# Melaka Memory Book

A single-page static site that documents the Melaka trip, 22–24 May 2026.
Lives at https://jmyz72.github.io/melaka-trip/.

## Local dev

```bash
python3 -m http.server 8000  # then open http://localhost:8000/
node --test tests/*.mjs      # run all tests
```

## Adding a stop

```bash
npm install                  # one-time; pulls in `sharp` (HEIC + dims) and `exifr` (EXIF reader)
brew install ffmpeg          # one-time; for video posters + dims
node tools/add-stop.mjs      # interactive prompts
# or with flags:
node tools/add-stop.mjs \
  --id jonker-walk \
  --name "Jonker Walk 鸡场街" \
  --day 1 --time 14:30 \
  --maps "https://maps.app.goo.gl/..." \
  --media ~/Downloads/jonker-photos/
```

The script reads EXIF from the first photo to auto-fill `time`, `day`, and
`lat/lng`. Flags override EXIF; prompts fall back to EXIF then to empty.
It copies media into `media/<id>/`, generates posters for videos, and upserts
the entry into `memories.json`. Always commit `memories.json` and
`media/<id>/` together.

## Ratings

Friends rate each stop 1–5 stars from the live site. Ratings live in
Firestore (collection `ratings`), keyed by an anonymous uid stored in each
browser's `localStorage`. The card shows the average + count.

To deploy security rule changes:

```bash
firebase deploy --only firestore:rules --project project-21c844a6-e5cc-4a62-920
```

## Deploy

`git push origin main` — GitHub Pages serves the result.
