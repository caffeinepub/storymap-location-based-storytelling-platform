import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Format distance value with appropriate unit
 * @param distanceKm - distance in kilometers
 * @returns formatted string like "1.2 km" or "500 m"
 */
export function formatDistanceValue(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Format distance with "away" suffix
 * @param distanceKm - distance in kilometers
 * @returns formatted string like "1.2 km away"
 */
export function formatDistance(distanceKm: number): string {
  return `${formatDistanceValue(distanceKm)} away`;
}

/**
 * Format location with distance and place name
 * @param distanceKm - distance in kilometers
 * @param placeName - reverse-geocoded place name
 * @returns formatted string like "1.2 km away from Central Park" or "Distance unavailable"
 */
export function formatLocationWithDistance(
  distanceKm: number | null,
  placeName: string | null
): string {
  if (distanceKm === null) {
    return placeName || 'Distance unavailable';
  }

  const distanceText = formatDistance(distanceKm);
  
  if (placeName) {
    return `${distanceText} from ${placeName}`;
  }
  
  return distanceText;
}
