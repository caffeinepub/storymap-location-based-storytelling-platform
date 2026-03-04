/**
 * Utility for proximity-based story filtering.
 * Compares base coordinates (user location or teleported location)
 * against each story's own latitude/longitude fields.
 * Never uses uploader/author location.
 */

export const LOCATION_FILTER_RADIUS_KM = 10;
export const DEFAULT_PROXIMITY_RADIUS_KM = LOCATION_FILTER_RADIUS_KM;

/**
 * Haversine distance in km between two lat/lng points.
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Returns true if the story's own coordinates (storyLat, storyLng)
 * are within `radiusKm` of the base location (baseLat, baseLng).
 *
 * @param baseLat  - latitude of the filter center (teleported or user geolocation)
 * @param baseLng  - longitude of the filter center
 * @param storyLat - story.latitude (the coordinate where the story was pinned)
 * @param storyLng - story.longitude
 * @param radiusKm - maximum allowed distance in km
 */
export function isStoryWithinProximity(
  baseLat: number,
  baseLng: number,
  storyLat: number,
  storyLng: number,
  radiusKm: number,
): boolean {
  const debugEnabled =
    typeof localStorage !== "undefined" &&
    localStorage.getItem("debug_distance_filter") === "true";

  const dist = haversineDistanceKm(baseLat, baseLng, storyLat, storyLng);
  const included = dist <= radiusKm;

  if (debugEnabled) {
    console.log(
      `[distanceFilter] story @ (${storyLat.toFixed(4)}, ${storyLng.toFixed(4)}) ` +
        `dist=${dist.toFixed(2)}km radius=${radiusKm}km → ${included ? "INCLUDE" : "EXCLUDE"}`,
    );
  }

  return included;
}

/**
 * Legacy alias kept for backward compatibility.
 * Checks if a story (with story.latitude / story.longitude) is within radius of selected coords.
 */
export function isStoryWithinRadius(
  story: { latitude: number; longitude: number },
  selectedLat: number,
  selectedLng: number,
  radiusKm: number = LOCATION_FILTER_RADIUS_KM,
): boolean {
  return isStoryWithinProximity(
    selectedLat,
    selectedLng,
    story.latitude,
    story.longitude,
    radiusKm,
  );
}
