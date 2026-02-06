// Reverse geocoding using OpenStreetMap Nominatim API
// Caches results to avoid repeated requests for the same location

interface NominatimResponse {
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    neighbourhood?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

// Round coordinates to reduce cache key variations
function roundCoordinate(coord: number, precision: number = 3): number {
  const factor = Math.pow(10, precision);
  return Math.round(coord * factor) / factor;
}

function getCacheKey(lat: number, lon: number): string {
  return `${roundCoordinate(lat)},${roundCoordinate(lon)}`;
}

// In-memory cache
const memoryCache = new Map<string, string>();

// LocalStorage cache with error handling
function getCachedPlace(key: string): string | null {
  // Check memory cache first
  if (memoryCache.has(key)) {
    return memoryCache.get(key)!;
  }

  // Check localStorage
  try {
    const cached = localStorage.getItem(`geocode_${key}`);
    if (cached) {
      memoryCache.set(key, cached);
      return cached;
    }
  } catch (error) {
    // localStorage might be unavailable
  }
  return null;
}

function setCachedPlace(key: string, placeName: string): void {
  // Set in memory cache
  memoryCache.set(key, placeName);

  // Set in localStorage
  try {
    localStorage.setItem(`geocode_${key}`, placeName);
  } catch (error) {
    // localStorage might be full or unavailable
  }
}

function extractPlaceName(data: NominatimResponse): string {
  // Try to get a concise place name from the address components
  const addr = data.address;
  if (addr) {
    // Prefer city/town/village names
    const place = addr.city || addr.town || addr.village || addr.suburb || addr.neighbourhood;
    if (place) return place;
    
    // Fall back to county or state
    if (addr.county) return addr.county;
    if (addr.state) return addr.state;
  }

  // Fall back to display_name, but try to shorten it
  if (data.display_name) {
    // Take first 2-3 components of the display name
    const parts = data.display_name.split(',').slice(0, 3);
    return parts.join(',').trim();
  }

  return 'Unknown location';
}

export async function reverseGeocode(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<string> {
  const cacheKey = getCacheKey(lat, lon);

  // Check cache first
  const cached = getCachedPlace(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch from Nominatim
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`;

  try {
    const response = await fetch(url, {
      signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'StoryMap/1.0', // Nominatim requires a User-Agent
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: NominatimResponse = await response.json();
    const placeName = extractPlaceName(data);

    // Cache the result
    setCachedPlace(cacheKey, placeName);

    return placeName;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw error;
    }
    // Return a fallback instead of throwing
    return 'Unknown location';
  }
}
