/**
 * Opt-in debug helper for distance filtering
 * Enable by setting localStorage.debug_distance_filter = 'true'
 */

const DEBUG_KEY = 'debug_distance_filter';

export function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DEBUG_KEY) === 'true';
  } catch {
    return false;
  }
}

export function logFilterCenter(
  source: 'user-location' | 'map-selection' | 'none',
  coords: { latitude: number; longitude: number } | null,
  radiusKm: number
) {
  if (!isDebugEnabled()) return;
  
  console.group('🎯 Distance Filter Center');
  console.log('Source:', source);
  console.log('Coordinates:', coords);
  console.log('Radius:', `${radiusKm}km`);
  console.groupEnd();
}

export function logStoryFilterDecision(
  storyId: string,
  storyTitle: string,
  storyCoords: { latitude: number; longitude: number },
  centerCoords: { latitude: number; longitude: number },
  distance: number,
  radiusKm: number,
  included: boolean
) {
  if (!isDebugEnabled()) return;
  
  const emoji = included ? '✅' : '❌';
  console.log(
    `${emoji} Story "${storyTitle}" (${storyId}):`,
    `${distance.toFixed(2)}km from center`,
    included ? `(within ${radiusKm}km)` : `(outside ${radiusKm}km)`
  );
}

export function enableDebug() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEBUG_KEY, 'true');
    console.log('✅ Distance filter debug enabled. Reload to see logs.');
  } catch (e) {
    console.error('Failed to enable debug:', e);
  }
}

export function disableDebug() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DEBUG_KEY);
    console.log('❌ Distance filter debug disabled.');
  } catch (e) {
    console.error('Failed to disable debug:', e);
  }
}

// Expose to window for easy console access
if (typeof window !== 'undefined') {
  (window as any).distanceFilterDebug = {
    enable: enableDebug,
    disable: disableDebug,
    isEnabled: isDebugEnabled,
  };
}
