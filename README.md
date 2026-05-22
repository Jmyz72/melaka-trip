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
npm install                  # one-time; pulls in `sharp` for HEIC + dims
brew install ffmpeg          # one-time; for video posters + dims
node tools/add-stop.mjs      # interactive prompts
# or with flags:
node tools/add-stop.mjs \
  --id jonker-walk \
  --name "Jonker Walk 鸡场街" \
  --day 1 --time 14:30 --rating 4 \
  --maps "https://maps.app.goo.gl/..." \
  --media ~/Downloads/jonker-photos/
```

The script copies media into `media/<id>/`, generates posters for videos, reads
dimensions, and upserts the entry into `memories.json`. Always commit
`memories.json` and `media/<id>/` together.

## Deploy

`git push origin main` — GitHub Pages serves the result.
