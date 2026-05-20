# Melaka 3D2N Trip Planner

Static mobile-first HTML page with a Leaflet map and a 3-day itinerary, built from a hand-curated list of places.

## Run locally

```
python3 -m http.server 8000
```
Open http://localhost:8000/

## Regenerate `places.json`

Edit `places.raw.json`, then:
```
node tools/build-places.mjs
node --test tests/
```

## Deploy to GitHub Pages

1. Create an empty public repo on github.com named `melaka-trip`.
2. From this folder:
   ```
   git remote add origin git@github.com:<your-username>/melaka-trip.git
   git push -u origin main
   ```
3. On github.com: Settings → Pages → Source: `Deploy from a branch`, Branch: `main` / `/ (root)`, Save.
4. Page goes live at `https://<your-username>.github.io/melaka-trip/`.
