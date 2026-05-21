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

## Real Google drive times (optional)

By default, drive times between stops are a haversine-based estimate (off by
up to ~15 min on city/highway transitions). To swap in real Google
Distance Matrix numbers:

1. Enable the **Distance Matrix API** in Google Cloud Console and create an
   API key (restrict it to that API).
2. Run:
   ```
   GOOGLE_MAPS_API_KEY=AIza... node tools/precompute-drives.mjs
   ```
3. Commit the resulting `lib/drives.json`. The app loads it automatically;
   absence is fine and falls back to the heuristic.

Cost: ~$4 of the $200/month free credit, only when you re-run the script.

## Deploy to GitHub Pages

1. Create an empty public repo on github.com named `melaka-trip`.
2. From this folder:
   ```
   git remote add origin git@github.com:<your-username>/melaka-trip.git
   git push -u origin main
   ```
3. On github.com: Settings → Pages → Source: `Deploy from a branch`, Branch: `main` / `/ (root)`, Save.
4. Page goes live at `https://<your-username>.github.io/melaka-trip/`.
