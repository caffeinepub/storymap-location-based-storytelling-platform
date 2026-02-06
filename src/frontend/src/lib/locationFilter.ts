import { calculateDistance } from './utils';
import type { Story } from '../backend';
import { logStoryFilterDecision } from './distanceFilterDebug';

// Proximity radius in kilometers for location-based filtering
export const LOCATION_FILTER_RADIUS_KM = 5;

/**
 * Check if a story is within the proximity radius of the selected coordinates
 */
export function isStoryWithinRadius(
  story: Story,
  selectedLat: number,
  selectedLng: number,
  radiusKm: number = LOCATION_FILTER_RADIUS_KM
): boolean {
  const distance = calculateDistance(
    selectedLat,
    selectedLng,
    story.location.latitude,
    story.location.longitude
  );
  
  const included = distance <= radiusKm;
  
  // Debug logging (opt-in via localStorage)
  logStoryFilterDecision(
    story.id,
    story.title,
    story.location,
    { latitude: selectedLat, longitude: selectedLng },
    distance,
    radiusKm,
    included
  );
  
  return included;
}
