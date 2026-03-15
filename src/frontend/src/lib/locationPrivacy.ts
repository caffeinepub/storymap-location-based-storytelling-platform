/**
 * Adds a random offset of minMeters–maxMeters in a random bearing to the coordinates.
 * This hides the exact location while keeping the story in the right neighbourhood.
 */
export function fuzzCoordinates(
  lat: number,
  lng: number,
  minMeters = 200,
  maxMeters = 500,
): { lat: number; lng: number } {
  const R = 6371000; // Earth radius in meters
  const distance = minMeters + Math.random() * (maxMeters - minMeters);
  const bearing = Math.random() * 2 * Math.PI; // random direction in radians

  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const angDist = distance / R;

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angDist) +
      Math.cos(latRad) * Math.sin(angDist) * Math.cos(bearing),
  );
  const newLngRad =
    lngRad +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angDist) * Math.cos(latRad),
      Math.cos(angDist) - Math.sin(latRad) * Math.sin(newLatRad),
    );

  return {
    lat: (newLatRad * 180) / Math.PI,
    lng: (newLngRad * 180) / Math.PI,
  };
}

/**
 * Snaps coordinates to the nearest ~500m grid cell centre (area-level pinning).
 * The grid step in degrees is approximately 500m / 111320m ≈ 0.004494°.
 */
export function snapToAreaCenter(
  lat: number,
  lng: number,
  gridMeters = 500,
): { lat: number; lng: number } {
  const step = gridMeters / 111320; // degrees per grid cell
  return {
    lat: Math.round(lat / step) * step,
    lng: Math.round(lng / step) * step,
  };
}

/**
 * Applies both fuzzing and area snapping to produce privacy-safe coordinates.
 * Use this before storing any user-submitted story location.
 */
export function applyLocationPrivacy(
  lat: number,
  lng: number,
): { lat: number; lng: number } {
  const fuzzed = fuzzCoordinates(lat, lng);
  return snapToAreaCenter(fuzzed.lat, fuzzed.lng);
}
