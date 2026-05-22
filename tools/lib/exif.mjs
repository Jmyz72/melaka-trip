// Read EXIF metadata from a photo file. Returns time (HH:MM), lat, lng, and
// the trip-day number (1/2/3) when the photo was taken on a known trip date.
// Any field may be null if missing.
import { readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import exifr from "exifr";

const PHOTO_EXT = new Set([".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"]);

// Trip date → day number. Times are interpreted in local (Malaysia) time as
// recorded by the camera; no timezone conversion is performed.
const TRIP_DAYS = {
  "2026-05-22": 1,
  "2026-05-23": 2,
  "2026-05-24": 3,
};

export async function firstPhoto(mediaDir) {
  const entries = (await readdir(mediaDir)).sort();
  for (const e of entries) {
    if (PHOTO_EXT.has(extname(e).toLowerCase())) return join(mediaDir, e);
  }
  return null;
}

export async function readExif(filePath) {
  const out = { time: null, lat: null, lng: null, day: null, takenAt: null };
  try {
    const data = await exifr.parse(filePath, { gps: true });
    if (!data) return out;
    const dt = data.DateTimeOriginal || data.CreateDate || data.ModifyDate;
    if (dt instanceof Date && !isNaN(dt)) {
      out.takenAt = dt;
      const hh = String(dt.getHours()).padStart(2, "0");
      const mm = String(dt.getMinutes()).padStart(2, "0");
      out.time = `${hh}:${mm}`;
      const yyyy = dt.getFullYear();
      const mo = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      const key = `${yyyy}-${mo}-${dd}`;
      if (TRIP_DAYS[key]) out.day = TRIP_DAYS[key];
    }
    if (typeof data.latitude === "number" && typeof data.longitude === "number") {
      out.lat = data.latitude;
      out.lng = data.longitude;
    }
  } catch {
    // EXIF parse errors are non-fatal — fall through with nulls.
  }
  return out;
}
