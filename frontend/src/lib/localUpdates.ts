import { LocalCategory } from '../backend';
import { calculateDistance } from './utils';

// Category label mapping
export function getLocalCategoryLabel(category: LocalCategory): string {
  switch (category) {
    case LocalCategory.traffic:
      return 'Traffic';
    case LocalCategory.power:
      return 'Power';
    case LocalCategory.police:
      return 'Police';
    case LocalCategory.event:
      return 'Event';
    case LocalCategory.nature:
      return 'Nature';
    case LocalCategory.general:
      return 'General';
    default:
      return 'General';
  }
}

// Category color mapping
export function getLocalCategoryColor(category: LocalCategory): string {
  switch (category) {
    case LocalCategory.traffic:
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    case LocalCategory.power:
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case LocalCategory.police:
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case LocalCategory.event:
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case LocalCategory.nature:
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case LocalCategory.general:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
  }
}

// Category icon color for map markers
export function getLocalCategoryIconColor(category: LocalCategory): string {
  switch (category) {
    case LocalCategory.traffic:
      return '#f97316'; // orange-500
    case LocalCategory.power:
      return '#eab308'; // yellow-500
    case LocalCategory.police:
      return '#3b82f6'; // blue-500
    case LocalCategory.event:
      return '#a855f7'; // purple-500
    case LocalCategory.nature:
      return '#22c55e'; // green-500
    case LocalCategory.general:
      return '#6b7280'; // gray-500
    default:
      return '#6b7280';
  }
}

// Format radius for display
export function formatRadius(meters: number): string {
  if (meters < 1000) {
    return `${meters}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

// Check if user is within update radius
export function isWithinRadius(
  userLat: number,
  userLon: number,
  updateLat: number,
  updateLon: number,
  radiusMeters: number
): boolean {
  const distanceKm = calculateDistance(userLat, userLon, updateLat, updateLon);
  const distanceMeters = distanceKm * 1000;
  return distanceMeters <= radiusMeters;
}

// Compute relevance data for a local update
export interface LocalUpdateRelevance {
  isRelevant: boolean;
  distanceKm: number | null;
  distanceMeters: number | null;
}

export function computeRelevance(
  update: { latitude: number; longitude: number; radius: bigint },
  userLocation: { latitude: number; longitude: number } | null
): LocalUpdateRelevance {
  if (!userLocation) {
    return {
      isRelevant: false,
      distanceKm: null,
      distanceMeters: null,
    };
  }

  const distanceKm = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    update.latitude,
    update.longitude
  );
  const distanceMeters = distanceKm * 1000;
  const radiusMeters = Number(update.radius);
  const isRelevant = distanceMeters <= radiusMeters;

  return {
    isRelevant,
    distanceKm,
    distanceMeters,
  };
}
