// Resolve a Google Maps short URL (https://maps.app.goo.gl/…) to {lat, lng}.
// Two layers:
//   resolveShortUrl(url) → follows redirects and returns the final long URL
//   extractLatLng(longUrl) → parses lat/lng out of the long URL

export function extractLatLng(longUrl) {
  // Prefer the !3d / !4d form which is the canonical place coordinate.
  const place = longUrl.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (place) return { lat: Number(place[1]), lng: Number(place[2]) };
  // Fallback: @lat,lng,zoomZ form (viewport center; usually close enough).
  const at = longUrl.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),/);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]) };
  return null;
}

export async function resolveShortUrl(shortUrl) {
  // GET (not HEAD — Google sometimes blocks HEAD) and follow redirects manually.
  let url = shortUrl;
  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, { redirect: "manual" });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location"), url).toString();
      continue;
    }
    return url;
  }
  throw new Error(`too many redirects starting from ${shortUrl}`);
}

export async function resolveCoords(input) {
  // Accepts: lat,lng pair like "2.1956,102.2486" — returns it directly.
  const direct = input.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (direct) return { lat: Number(direct[1]), lng: Number(direct[2]) };
  // Accepts: a https://… URL — short or long.
  const long = input.startsWith("https://maps.app.goo.gl/") ? await resolveShortUrl(input) : input;
  const coords = extractLatLng(long);
  if (!coords) throw new Error(`could not extract coords from ${long}`);
  return coords;
}
