import { useEffect, useRef, useState } from 'react';
import type { Story } from '../backend';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getCategoryLabel, getCategoryColor } from '../lib/categories';
import { calculateDistance, formatDistance } from '../lib/utils';
import { MapPin, Eye, Search, Loader2, AlertCircle, Maximize2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MapViewProps {
  stories: Story[];
  userLocation: { latitude: number; longitude: number } | null;
  onStoryClick: (story: Story) => void;
  onMapBackgroundClick?: (latitude: number, longitude: number) => void;
  selectedLocation?: { latitude: number; longitude: number } | null;
}

interface SearchResult {
  lat: string;
  lon: string;
  display_name: string;
}

export default function MapView({ stories, userLocation, onStoryClick, onMapBackgroundClick, selectedLocation }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const clusterGroupRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const tempMarkerRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<number>(0);
  const hasAutoFittedRef = useRef(false);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [selectedLatLng, setSelectedLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [clusterPluginLoaded, setClusterPluginLoaded] = useState(false);
  const [L, setL] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState('');

  // Load Leaflet and clustering plugin dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if Leaflet is already loaded
    if ((window as any).L) {
      setL((window as any).L);
      setLeafletLoaded(true);
      
      // Check if clustering plugin is already loaded
      if ((window as any).L.markerClusterGroup) {
        setClusterPluginLoaded(true);
      }
      return;
    }

    // Load Leaflet CSS
    const leafletCSS = document.createElement('link');
    leafletCSS.rel = 'stylesheet';
    leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    leafletCSS.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    leafletCSS.crossOrigin = '';
    document.head.appendChild(leafletCSS);

    // Load Leaflet JS
    const leafletScript = document.createElement('script');
    leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    leafletScript.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    leafletScript.crossOrigin = '';
    leafletScript.async = true;
    leafletScript.onload = () => {
      setL((window as any).L);
      setLeafletLoaded(true);
    };
    document.head.appendChild(leafletScript);

    return () => {
      // Cleanup
      if (leafletCSS.parentNode) leafletCSS.parentNode.removeChild(leafletCSS);
      if (leafletScript.parentNode) leafletScript.parentNode.removeChild(leafletScript);
    };
  }, []);

  // Load clustering plugin after Leaflet is loaded
  useEffect(() => {
    if (!leafletLoaded || !L || clusterPluginLoaded) return;

    // Load MarkerCluster CSS
    const clusterCSS = document.createElement('link');
    clusterCSS.rel = 'stylesheet';
    clusterCSS.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
    document.head.appendChild(clusterCSS);

    const clusterDefaultCSS = document.createElement('link');
    clusterDefaultCSS.rel = 'stylesheet';
    clusterDefaultCSS.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
    document.head.appendChild(clusterDefaultCSS);

    // Load MarkerCluster JS
    const clusterScript = document.createElement('script');
    clusterScript.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
    clusterScript.async = true;
    clusterScript.onload = () => {
      setClusterPluginLoaded(true);
    };
    document.head.appendChild(clusterScript);

    return () => {
      if (clusterCSS.parentNode) clusterCSS.parentNode.removeChild(clusterCSS);
      if (clusterDefaultCSS.parentNode) clusterDefaultCSS.parentNode.removeChild(clusterDefaultCSS);
      if (clusterScript.parentNode) clusterScript.parentNode.removeChild(clusterScript);
    };
  }, [leafletLoaded, L, clusterPluginLoaded]);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !clusterPluginLoaded || !L || !mapContainerRef.current || mapInstanceRef.current) return;

    // Default center (will be updated based on stories/user location)
    const defaultCenter: [number, number] = userLocation
      ? [userLocation.latitude, userLocation.longitude]
      : [40.7128, -74.006]; // New York as fallback

    // Create map instance
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 12,
      zoomControl: true,
    });

    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Add map click handler for temporary pin and location filter
    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      setSelectedLatLng({ lat, lng });

      // Trigger location filter callback if provided
      if (onMapBackgroundClick) {
        onMapBackgroundClick(lat, lng);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [leafletLoaded, clusterPluginLoaded, L, userLocation, onMapBackgroundClick]);

  // Controlled temporary marker based on selectedLocation prop
  useEffect(() => {
    if (!leafletLoaded || !clusterPluginLoaded || !L || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // If selectedLocation is null, remove the temporary marker
    if (!selectedLocation) {
      if (tempMarkerRef.current) {
        map.removeLayer(tempMarkerRef.current);
        tempMarkerRef.current = null;
      }
      setSelectedLatLng(null);
      return;
    }

    // Create or update temporary marker at selectedLocation
    const { latitude, longitude } = selectedLocation;

    const tempIcon = L.divIcon({
      html: `
        <div class="relative w-10 h-10 flex items-center justify-center">
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 border-2 border-white shadow-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
          </div>
        </div>
      `,
      className: 'custom-temp-marker',
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });

    if (tempMarkerRef.current) {
      // Update existing marker position
      tempMarkerRef.current.setLatLng([latitude, longitude]);
      tempMarkerRef.current.setIcon(tempIcon);
    } else {
      // Create new marker
      tempMarkerRef.current = L.marker([latitude, longitude], { icon: tempIcon }).addTo(map);
      tempMarkerRef.current.bindPopup('<div class="p-2 text-sm font-semibold">Selected Location</div>');
    }

    // Update local state for display
    setSelectedLatLng({ lat: latitude, lng: longitude });
  }, [leafletLoaded, clusterPluginLoaded, L, selectedLocation]);

  // Update markers when stories or user location changes (without auto-fitting after initial load)
  useEffect(() => {
    if (!leafletLoaded || !clusterPluginLoaded || !L || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Clear existing cluster group and user marker
    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current);
      clusterGroupRef.current = null;
    }
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    // Create new marker cluster group
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: true,
      zoomToBoundsOnClick: true,
    });

    // Create custom icon for story markers
    const storyIcon = L.divIcon({
      html: `
        <div class="relative w-12 h-12 flex items-center justify-center">
          <img src="/assets/generated/story-marker.dim_48x48.png" alt="Story" class="w-full h-full" />
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="w-3 h-3 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 animate-pulse"></div>
          </div>
        </div>
      `,
      className: 'custom-story-marker',
      iconSize: [48, 48],
      iconAnchor: [24, 48],
      popupAnchor: [0, -48],
    });

    // Add story markers to cluster group
    const bounds: [number, number][] = [];
    stories.forEach((story) => {
      const position: [number, number] = [story.location.latitude, story.location.longitude];
      bounds.push(position);

      const marker = L.marker(position, { icon: storyIcon });

      // Create popup content
      const distance = userLocation
        ? formatDistance(
            calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              story.location.latitude,
              story.location.longitude
            )
          )
        : '';

      const popupContent = `
        <div class="p-2 min-w-[200px]">
          <div class="flex items-start justify-between gap-2 mb-2">
            <h3 class="font-semibold text-sm">${story.title}</h3>
            <span class="text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
              ${getCategoryLabel(story.category)}
            </span>
          </div>
          <p class="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">${story.content}</p>
          <div class="flex items-center justify-between text-xs text-gray-500 mb-2">
            ${distance ? `<span>${distance} away</span>` : '<span></span>'}
            <span class="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              ${Number(story.viewCount)}
            </span>
          </div>
          <button 
            class="mt-2 w-full px-3 py-1 text-xs bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-md hover:opacity-90 transition-opacity"
            onclick="window.dispatchEvent(new CustomEvent('story-marker-click', { detail: '${story.id}' }))"
          >
            View Full Story
          </button>
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup',
      });

      // Stop propagation to prevent map click when clicking story marker
      marker.on('click', (e: any) => {
        L.DomEvent.stopPropagation(e);
        setSelectedStory(story);
      });

      // Add marker to cluster group instead of directly to map
      clusterGroup.addLayer(marker);
    });

    // Add cluster group to map
    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;

    // Add user location marker
    if (userLocation) {
      bounds.push([userLocation.latitude, userLocation.longitude]);

      const userIcon = L.divIcon({
        html: `
          <div class="relative w-6 h-6">
            <div class="absolute inset-0 rounded-full bg-blue-500 border-4 border-white shadow-lg animate-pulse"></div>
            <div class="absolute inset-0 rounded-full bg-blue-400 opacity-50 animate-ping"></div>
          </div>
        `,
        className: 'custom-user-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      userMarkerRef.current = L.marker([userLocation.latitude, userLocation.longitude], {
        icon: userIcon,
      }).addTo(map);

      userMarkerRef.current.bindPopup('<div class="p-2 text-sm font-semibold">Your Location</div>');
      
      // Stop propagation for user marker too
      userMarkerRef.current.on('click', (e: any) => {
        L.DomEvent.stopPropagation(e);
      });
    }

    // Only auto-fit on initial load
    if (bounds.length > 0 && !hasAutoFittedRef.current) {
      const latLngBounds = L.latLngBounds(bounds);
      map.fitBounds(latLngBounds, {
        padding: [50, 50],
        maxZoom: 15,
      });
      hasAutoFittedRef.current = true;
    }
  }, [leafletLoaded, clusterPluginLoaded, L, stories, userLocation]);

  // Handle story marker clicks from popup buttons
  useEffect(() => {
    const handleStoryMarkerClick = (event: any) => {
      const storyId = event.detail;
      const story = stories.find((s) => s.id === storyId);
      if (story) {
        onStoryClick(story);
      }
    };

    window.addEventListener('story-marker-click', handleStoryMarkerClick);
    return () => {
      window.removeEventListener('story-marker-click', handleStoryMarkerClick);
    };
  }, [stories, onStoryClick]);

  // Handle location search using Nominatim (OpenStreetMap geocoding)
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !mapInstanceRef.current) return;

    // Increment request ID for this new request
    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);
    setLastSearchQuery(searchQuery);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`,
        { signal: abortController.signal }
      );

      // Check if this request is still the latest
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      // Check if this request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      if (!response.ok) {
        throw new Error('Search request failed');
      }

      const data: SearchResult[] = await response.json();

      // Check again if this is still the latest request
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      // Check again if aborted after parsing
      if (abortController.signal.aborted) {
        return;
      }

      if (data && data.length > 0) {
        setSearchResults(data);
        setSearchError(null);
      } else {
        setSearchError('No locations found. Try a different search term.');
        setSearchResults([]);
      }
    } catch (error: any) {
      // Ignore abort errors
      if (error.name === 'AbortError') {
        return;
      }

      // Only set error if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        console.error('Search error:', error);
        setSearchError('Failed to search location. Please try again.');
        setSearchResults([]);
      }
    } finally {
      // Only clear loading if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        setIsSearching(false);
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    }
  };

  // Handle selecting a search result
  const handleSelectResult = (result: SearchResult) => {
    if (!mapInstanceRef.current || !L) return;

    const latitude = parseFloat(result.lat);
    const longitude = parseFloat(result.lon);

    // Pan and zoom to the location
    mapInstanceRef.current.setView([latitude, longitude], 13, {
      animate: true,
      duration: 1,
    });

    // Trigger location filter callback if provided
    if (onMapBackgroundClick) {
      onMapBackgroundClick(latitude, longitude);
    }

    // Clear search results after selection
    setSearchResults([]);
    setSearchQuery('');
  };

  // Retry last search
  const handleRetrySearch = () => {
    if (lastSearchQuery) {
      setSearchQuery(lastSearchQuery);
      // Trigger search via form submission
      const form = document.querySelector('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }
  };

  // Fit to results control
  const handleFitToResults = () => {
    if (!mapInstanceRef.current || !L) return;

    const bounds: [number, number][] = [];

    // Add story positions
    stories.forEach((story) => {
      bounds.push([story.location.latitude, story.location.longitude]);
    });

    // Add user location if available
    if (userLocation) {
      bounds.push([userLocation.latitude, userLocation.longitude]);
    }

    // Fit map to bounds
    if (bounds.length > 0) {
      const latLngBounds = L.latLngBounds(bounds);
      mapInstanceRef.current.fitBounds(latLngBounds, {
        padding: [50, 50],
        maxZoom: 15,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Location Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          {isSearching ? (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-spin pointer-events-none" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          )}
          <Input
            placeholder="Search for a location (e.g., New York, Paris, Tokyo)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            disabled={isSearching}
          />
          {isSearching && (
            <div className="absolute left-0 bottom-0 h-0.5 w-full bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
          )}
        </div>
        <Button type="submit" disabled={isSearching || !searchQuery.trim()}>
          {isSearching ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Search
            </>
          )}
        </Button>
      </form>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <h3 className="font-semibold text-sm mb-2">Search Results</h3>
            {searchResults.map((result, index) => (
              <button
                key={index}
                onClick={() => handleSelectResult(result)}
                className="w-full text-left p-3 rounded-md border hover:bg-accent transition-colors"
              >
                <p className="text-sm font-medium">{result.display_name}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Search Error */}
      {searchError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm">{searchError}</span>
            {lastSearchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetrySearch}
                className="ml-2"
              >
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Fit to Results Button */}
      {(stories.length > 0 || userLocation) && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleFitToResults}
          className="w-full"
        >
          <Maximize2 className="h-4 w-4 mr-2" />
          Fit to Results
        </Button>
      )}

      <div
        ref={mapContainerRef}
        className="relative w-full h-[600px] rounded-lg border overflow-hidden shadow-lg"
        style={{
          background: 'linear-gradient(to bottom right, oklch(var(--muted)), oklch(var(--background)))',
        }}
      >
        {(!leafletLoaded || !clusterPluginLoaded) && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          </div>
        )}
      </div>

      {selectedLatLng && (
        <Card className="animate-in slide-in-from-bottom-4 duration-300 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-md">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2 text-green-900 dark:text-green-100">Selected Location</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-green-800 dark:text-green-200">Latitude:</span>
                    <span className="text-green-700 dark:text-green-300 font-mono">{selectedLatLng.lat.toFixed(6)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-green-800 dark:text-green-200">Longitude:</span>
                    <span className="text-green-700 dark:text-green-300 font-mono">{selectedLatLng.lng.toFixed(6)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedStory && (
        <Card className="animate-in slide-in-from-bottom-4 duration-300">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h3 className="font-semibold text-lg">{selectedStory.title}</h3>
              <Badge variant="secondary" className={getCategoryColor(selectedStory.category)}>
                {getCategoryLabel(selectedStory.category)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{selectedStory.content}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {userLocation && (
                <span>
                  {formatDistance(
                    calculateDistance(
                      userLocation.latitude,
                      userLocation.longitude,
                      selectedStory.location.latitude,
                      selectedStory.location.longitude
                    )
                  )}{' '}
                  away
                </span>
              )}
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {Number(selectedStory.viewCount)} Views
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <style>{`
        .custom-story-marker {
          background: transparent;
          border: none;
        }
        .custom-user-marker {
          background: transparent;
          border: none;
        }
        .custom-temp-marker {
          background: transparent;
          border: none;
        }
        .custom-popup .leaflet-popup-content-wrapper {
          border-radius: 0.5rem;
          padding: 0;
        }
        .custom-popup .leaflet-popup-content {
          margin: 0;
        }
        .custom-popup .leaflet-popup-tip {
          background: white;
        }
        .dark .custom-popup .leaflet-popup-content-wrapper {
          background: oklch(var(--card));
          color: oklch(var(--card-foreground));
        }
        .dark .custom-popup .leaflet-popup-tip {
          background: oklch(var(--card));
        }
      `}</style>
    </div>
  );
}
