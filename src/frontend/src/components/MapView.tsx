import { useEffect, useRef, useState } from 'react';
import type { Story } from '../backend';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getCategoryLabel, getCategoryColor } from '../lib/categories';
import { calculateDistance, formatDistance } from '../lib/utils';
import { MapPin, Eye, Search, Loader2, AlertCircle, Maximize2, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { loadLeaflet, unloadLeaflet, loadMarkerCluster, unloadMarkerCluster } from '../lib/leafletLoader';
import { useLeafletMapResize } from '../hooks/useLeafletMapResize';

interface MapViewProps {
  stories: Story[];
  userLocation: { latitude: number; longitude: number } | null;
  onStoryClick: (story: Story) => void;
  onMapBackgroundClick?: (latitude: number, longitude: number) => void;
  selectedLocation?: { latitude: number; longitude: number } | null;
  isVisible?: boolean;
  centerCoordinate?: { latitude: number; longitude: number } | null;
}

interface SearchResult {
  lat: string;
  lon: string;
  display_name: string;
}

export default function MapView({ 
  stories, 
  userLocation, 
  onStoryClick, 
  onMapBackgroundClick, 
  selectedLocation,
  isVisible = true,
  centerCoordinate
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const clusterGroupRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const tempMarkerRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<number>(0);
  const hasAutoFittedRef = useRef(false);
  const searchFormRef = useRef<HTMLFormElement>(null);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [selectedLatLng, setSelectedLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [leafletError, setLeafletError] = useState<string | null>(null);
  const [clusterPluginLoaded, setClusterPluginLoaded] = useState(false);
  const [L, setL] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState('');
  const [mapReady, setMapReady] = useState(false);

  // Load Leaflet using shared loader with error handling
  useEffect(() => {
    let mounted = true;

    loadLeaflet()
      .then((leaflet) => {
        if (mounted) {
          setL(leaflet);
          setLeafletLoaded(true);
          setLeafletError(null);
        }
      })
      .catch((error) => {
        console.error('Failed to load Leaflet:', error);
        if (mounted) {
          setLeafletError('Failed to load map library. Please refresh the page.');
        }
      });

    return () => {
      mounted = false;
      unloadLeaflet();
    };
  }, []);

  // Load clustering plugin after Leaflet is loaded (only if stories exist)
  useEffect(() => {
    if (!leafletLoaded || !L) return;
    
    // Skip clustering if no stories (e.g., location picker)
    if (stories.length === 0) {
      setClusterPluginLoaded(true);
      return;
    }

    let mounted = true;

    loadMarkerCluster()
      .then(() => {
        if (mounted) {
          setClusterPluginLoaded(true);
        }
      })
      .catch((error) => {
        console.error('Failed to load MarkerCluster:', error);
        // Still allow map to work without clustering
        if (mounted) {
          setClusterPluginLoaded(true);
        }
      });

    return () => {
      mounted = false;
      if (stories.length > 0) {
        unloadMarkerCluster();
      }
    };
  }, [leafletLoaded, L, stories.length]);

  // Initialize map (only once per mount) - now only waits for Leaflet
  useEffect(() => {
    if (!leafletLoaded || !L || !mapContainerRef.current || mapInstanceRef.current) return;

    try {
      // Default center (will be updated based on stories/user location/selectedLocation)
      const defaultCenter: [number, number] = selectedLocation
        ? [selectedLocation.latitude, selectedLocation.longitude]
        : userLocation
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
      setMapReady(true);
      setLeafletError(null);
    } catch (error) {
      console.error('Failed to initialize map:', error);
      setLeafletError('Failed to initialize map. Please refresh the page.');
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (error) {
          console.error('Error removing map:', error);
        }
        mapInstanceRef.current = null;
        setMapReady(false);
      }
    };
  }, [leafletLoaded, L]);

  // Use resize hook to fix map display when dialog opens or becomes visible
  useLeafletMapResize(mapReady ? mapInstanceRef.current : null, isVisible);

  // Handle centering when centerCoordinate changes (for location picker)
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !L || !centerCoordinate) return;

    const map = mapInstanceRef.current;
    
    // Use a small delay to ensure map is fully rendered before centering
    const timeoutId = setTimeout(() => {
      if (map && typeof map.setView === 'function') {
        map.setView([centerCoordinate.latitude, centerCoordinate.longitude], 13, {
          animate: true,
        });
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [mapReady, L, centerCoordinate]);

  // Controlled temporary marker based on selectedLocation prop
  useEffect(() => {
    if (!mapReady || !L || !mapInstanceRef.current) return;

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
  }, [mapReady, L, selectedLocation]);

  // Update markers when stories or user location changes (without auto-fitting after initial load)
  useEffect(() => {
    if (!mapReady || !clusterPluginLoaded || !L || !mapInstanceRef.current) return;

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

    // Create new marker cluster group only if there are stories
    if (stories.length > 0) {
      const useCluster = (window as any).L?.markerClusterGroup && stories.length > 1;
      
      let markerContainer: any;
      
      if (useCluster) {
        markerContainer = L.markerClusterGroup({
          maxClusterRadius: 60,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: true,
          zoomToBoundsOnClick: true,
        });
      } else {
        // Use a layer group if clustering is unavailable
        markerContainer = L.layerGroup();
      }

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
        });

        markerContainer.addLayer(marker);
      });

      // Add cluster group to map
      map.addLayer(markerContainer);
      clusterGroupRef.current = markerContainer;

      // Auto-fit bounds only on initial load
      if (!hasAutoFittedRef.current && bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        hasAutoFittedRef.current = true;
      }
    }

    // Add user location marker if available
    if (userLocation) {
      const userIcon = L.divIcon({
        html: `
          <div class="relative w-10 h-10 flex items-center justify-center">
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white shadow-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
            </div>
            <div class="absolute inset-0 rounded-full bg-blue-400 opacity-30 animate-ping"></div>
          </div>
        `,
        className: 'custom-user-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      });

      userMarkerRef.current = L.marker([userLocation.latitude, userLocation.longitude], {
        icon: userIcon,
        zIndexOffset: 1000,
      }).addTo(map);

      userMarkerRef.current.bindPopup('<div class="p-2 text-sm font-semibold">Your Location</div>');
    }
  }, [mapReady, clusterPluginLoaded, L, stories, userLocation]);

  // Listen for story marker clicks
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !mapInstanceRef.current) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const currentRequestId = ++requestIdRef.current;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`,
        {
          signal: abortController.signal,
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data: SearchResult[] = await response.json();

      // Only update if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        if (data.length === 0) {
          setSearchError('No results found. Try a different search term.');
        } else {
          setSearchResults(data);
          setLastSearchQuery(searchQuery);
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }
      console.error('Search error:', error);
      if (currentRequestId === requestIdRef.current) {
        setSearchError('Search failed. Please try again.');
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsSearching(false);
      }
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (!mapInstanceRef.current) return;

    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    mapInstanceRef.current.setView([lat, lon], 14, {
      animate: true,
    });

    // Set the selected location via callback so HomePage can update mapSelectedLocation
    if (onMapBackgroundClick) {
      onMapBackgroundClick(lat, lon);
    }

    // Clear search results after selection
    setSearchResults([]);
    setSearchQuery('');
    setLastSearchQuery('');
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setLastSearchQuery('');
  };

  // Show error state if Leaflet failed to load
  if (leafletError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/20">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{leafletError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show loading state while Leaflet is loading
  if (!leafletLoaded || !mapReady) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[600px] rounded-lg overflow-hidden border shadow-lg">
      {/* Map container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Search bar overlay */}
      <div className="absolute top-4 left-4 right-4 z-[1000] max-w-md">
        <form ref={searchFormRef} onSubmit={handleSearch} className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search for a place..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 bg-background/95 backdrop-blur-sm shadow-lg"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="shadow-lg"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>

        {/* Search results dropdown */}
        {(searchResults.length > 0 || searchError) && (
          <Card className="mt-2 shadow-xl bg-background/95 backdrop-blur-sm">
            <CardContent className="p-2">
              {searchError ? (
                <div className="flex items-center gap-2 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{searchError}</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                    Results for "{lastSearchQuery}"
                  </div>
                  {searchResults.map((result, index) => (
                    <button
                      key={index}
                      onClick={() => handleResultClick(result)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-md transition-colors flex items-start gap-2"
                    >
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                      <span className="line-clamp-2">{result.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Selected coordinates display */}
      {selectedLatLng && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-background/95 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg border">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="font-mono">
              {selectedLatLng.lat.toFixed(6)}, {selectedLatLng.lng.toFixed(6)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
