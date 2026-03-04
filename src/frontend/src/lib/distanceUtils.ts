/**
 * Distance calculation and formatting utilities.
 * Uses the Haversine formula for accurate great-circle distances.
 */

/**
 * Compute the Haversine distance in km between two lat/lng points.
 * Returns the result in kilometres.
 */
export function calculateDistance(
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
 * Format a distance in km into a human-readable string.
 *   < 1 km  →  "450 m"
 *   ≥ 1 km  →  "3.2 km"
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Alias for formatDistance — kept so components that import
 * `formatDistanceValue` continue to work unchanged.
 */
export const formatDistanceValue = formatDistance;
