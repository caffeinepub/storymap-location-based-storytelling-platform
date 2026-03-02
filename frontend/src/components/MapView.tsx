import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Story } from '../backend';
import { Input } from '@/components/ui/input';
import { getCategoryLabel } from '../lib/categories';
import { calculateDistance, formatDistance } from '../lib/utils';
import { Search, Loader2, X } from 'lucide-react';
import { loadLeaflet, unloadLeaflet, loadMarkerCluster, unloadMarkerCluster } from '../lib/leafletLoader';
import { useLeafletMapResize } from '../hooks/useLeafletMapResize';
import { getCurrentLocationMarkerIcon } from '../lib/currentLocationMarker';

interface MapViewProps {
  stories: Story[];
  userLocation: { latitude: number; longitude: number } | null;
  onStoryClick: (story: Story) => void;
  onMapBackgroundClick?: (latitude: number, longitude: number) => void;
  selectedLocation?: { latitude: number; longitude: number } | null;
  isVisible?: boolean;
  centerCoordinate?: { latitude: number; longitude: number } | null;
}

export default function MapView({
  stories,
  userLocation,
  onStoryClick,
  onMapBackgroundClick,
  selectedLocation,
  isVisible = true,
  centerCoordinate,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const clusterGroupRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const tempMarkerRef = useRef<any>(null);
  const teleportMarkerRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasAutoFittedRef = useRef(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [leafletError, setLeafletError] = useState<string | null>(null);
  const [clusterPluginLoaded, setClusterPluginLoaded] = useState(false);
  const [L, setL] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isLoadingMap, setIsLoadingMap] = useState(true);

  // Load Leaflet
  useEffect(() => {
    let mounted = true;
    setIsLoadingMap(true);

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
          setIsLoadingMap(false);
        }
      });

    return () => {
      mounted = false;
      unloadLeaflet();
    };
  }, []);

  // Load clustering plugin after Leaflet is loaded
  useEffect(() => {
    if (!leafletLoaded || !L) return;

    if (stories.length === 0) {
      setClusterPluginLoaded(true);
      return;
    }

    let mounted = true;

    loadMarkerCluster()
      .then(() => {
        if (mounted) setClusterPluginLoaded(true);
      })
      .catch(() => {
        if (mounted) setClusterPluginLoaded(true);
      });

    return () => {
      mounted = false;
      if (stories.length > 0) unloadMarkerCluster();
    };
  }, [leafletLoaded, L, stories.length]);

  // Initialize map (only once per mount)
  useEffect(() => {
    if (!leafletLoaded || !L || !mapContainerRef.current || mapInstanceRef.current) return;

    try {
      const defaultCenter: [number, number] = selectedLocation
        ? [selectedLocation.latitude, selectedLocation.longitude]
        : userLocation
        ? [userLocation.latitude, userLocation.longitude]
        : [40.7128, -74.006];

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 12,
        zoomControl: true,
      });

      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      });

      tileLayer.on('load', () => setIsLoadingMap(false));
      tileLayer.on('tileerror', (error: any) => console.warn('Tile load error:', error));
      tileLayer.addTo(map);

      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        if (onMapBackgroundClick) {
          onMapBackgroundClick(lat, lng);
        }
      });

      mapInstanceRef.current = map;
      setMapReady(true);
      setLeafletError(null);

      setTimeout(() => setIsLoadingMap(false), 1000);
    } catch (error) {
      console.error('Failed to initialize map:', error);
      setLeafletError('Failed to initialize map. Please refresh the page.');
      setIsLoadingMap(false);
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

  useLeafletMapResize(mapReady ? mapInstanceRef.current : null, isVisible);

  // Handle centering when centerCoordinate changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !L || !centerCoordinate) return;

    const map = mapInstanceRef.current;
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

    if (!selectedLocation) {
      if (tempMarkerRef.current) {
        map.removeLayer(tempMarkerRef.current);
        tempMarkerRef.current = null;
      }
      return;
    }

    const { latitude, longitude } = selectedLocation;

    const tempIcon = L.divIcon({
      html: `
        <div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
          <div style="
            width:32px;height:32px;
            background:linear-gradient(135deg,#4ade80,#10b981);
            border:2px solid white;
            border-radius:50%;
            box-shadow:0 2px 8px rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:center;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        </div>
      `,
      className: 'custom-temp-marker',
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });

    if (tempMarkerRef.current) {
      tempMarkerRef.current.setLatLng([latitude, longitude]);
      tempMarkerRef.current.setIcon(tempIcon);
    } else {
      tempMarkerRef.current = L.marker([latitude, longitude], { icon: tempIcon }).addTo(map);
      tempMarkerRef.current.bindPopup('<div class="p-2 text-sm font-semibold">Selected Location</div>');
    }
  }, [mapReady, L, selectedLocation]);

  // Update story markers and user location marker
  useEffect(() => {
    if (!mapReady || !L || !mapInstanceRef.current) return;
    if (stories.length > 0 && !clusterPluginLoaded) return;

    const map = mapInstanceRef.current;

    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current);
      clusterGroupRef.current = null;
    }
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (stories.length > 0) {
      const useCluster = (window as any).L?.markerClusterGroup && stories.length > 1;

      const markerContainer = useCluster
        ? L.markerClusterGroup({
            maxClusterRadius: 60,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: true,
            zoomToBoundsOnClick: true,
          })
        : L.layerGroup();

      const storyIcon = L.divIcon({
        html: `
          <div style="width:48px;height:48px;position:relative;display:flex;align-items:center;justify-content:center;">
            <img src="/assets/generated/story-marker.dim_48x48.png" alt="Story" style="width:100%;height:100%;" />
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
              <div style="width:12px;height:12px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);animation:pulse 2s infinite;"></div>
            </div>
          </div>
        `,
        className: 'custom-story-marker',
        iconSize: [48, 48],
        iconAnchor: [24, 48],
        popupAnchor: [0, -48],
      });

      const bounds: [number, number][] = [];
      stories.forEach((story) => {
        const position: [number, number] = [story.latitude, story.longitude];
        bounds.push(position);

        const marker = L.marker(position, { icon: storyIcon });

        const distance = userLocation
          ? formatDistance(
              calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                story.latitude,
                story.longitude
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

        marker.bindPopup(popupContent, { maxWidth: 300, className: 'custom-popup' });
        marker.on('click', (e: any) => L.DomEvent.stopPropagation(e));
        markerContainer.addLayer(marker);
      });

      map.addLayer(markerContainer);
      clusterGroupRef.current = markerContainer;

      if (!hasAutoFittedRef.current && bounds.length > 0) {
        const latLngBounds = L.latLngBounds(bounds);
        map.fitBounds(latLngBounds, { padding: [50, 50], maxZoom: 15 });
        hasAutoFittedRef.current = true;
      }
    }

    if (userLocation) {
      const userIcon = getCurrentLocationMarkerIcon(L);
      userMarkerRef.current = L.marker(
        [userLocation.latitude, userLocation.longitude],
        { icon: userIcon }
      ).addTo(map);
      userMarkerRef.current.bindPopup('<div class="p-2 text-sm font-semibold">Your Location</div>');
    }
  }, [mapReady, clusterPluginLoaded, L, stories, userLocation]);

  // Handle story marker clicks via custom event
  useEffect(() => {
    const handleMarkerClick = (event: any) => {
      const storyId = event.detail;
      const story = stories.find((s) => s.id === storyId);
      if (story) onStoryClick(story);
    };

    window.addEventListener('story-marker-click', handleMarkerClick);
    return () => window.removeEventListener('story-marker-click', handleMarkerClick);
  }, [stories, onStoryClick]);

  // Geocode location name and teleport map
  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query || !mapInstanceRef.current || !L) return;

    // Clear previous error and abort any in-flight request
    setSearchError(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsSearching(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        {
          signal: abortControllerRef.current.signal,
          headers: { Accept: 'application/json' },
        }
      );

      if (!response.ok) throw new Error('Search request failed');

      const data = await response.json();

      if (!data || data.length === 0) {
        setSearchError('Location not found');
        setIsSearching(false);
        return;
      }

      const result = data[0];
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);

      if (isNaN(lat) || isNaN(lng)) {
        setSearchError('Location not found');
        setIsSearching(false);
        return;
      }

      const map = mapInstanceRef.current;

      // Remove previous teleport marker
      if (teleportMarkerRef.current) {
        map.removeLayer(teleportMarkerRef.current);
        teleportMarkerRef.current = null;
      }

      // Fly to the geocoded location at zoom 15
      map.flyTo([lat, lng], 15, { animate: true, duration: 1.2 });

      // Place a distinct teleport pin marker
      const teleportIcon = L.divIcon({
        className: '',
        html: `
          <div style="
            width: 28px;
            height: 28px;
            background: #ef4444;
            border: 3px solid white;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            position: relative;
          ">
            <div style="
              width: 8px;
              height: 8px;
              background: white;
              border-radius: 50%;
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
            "></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -32],
      });

      const locationLabel = result.display_name
        ? result.display_name.split(',').slice(0, 2).join(', ')
        : query;

      const marker = L.marker([lat, lng], { icon: teleportIcon, zIndexOffset: 900 }).addTo(map);
      marker.bindPopup(`<div class="p-2 text-sm font-semibold">${locationLabel}</div>`);
      teleportMarkerRef.current = marker;

      setIsSearching(false);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setSearchError('Location not found');
        setIsSearching(false);
      }
    }
  }, [searchQuery, L]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (searchError) setSearchError(null);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchError(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Bar — only shown when map is used as a location picker */}
      {onMapBackgroundClick && (
        <form onSubmit={handleSearch} className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search for a location..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-10 pr-20"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="text-muted-foreground hover:text-foreground p-1"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                {isSearching ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Search className="h-3 w-3" />
                )}
                Go
              </button>
            </div>
          </div>
          {searchError && (
            <p className="text-xs text-destructive mt-1 ml-1">{searchError}</p>
          )}
        </form>
      )}

      {/* Map Container */}
      <div className="relative">
        {isLoadingMap && !leafletError && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10 rounded-lg">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading map…</span>
            </div>
          </div>
        )}

        {leafletError && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10 rounded-lg">
            <div className="text-center p-4">
              <p className="text-sm text-destructive font-medium">{leafletError}</p>
            </div>
          </div>
        )}

        <div
          ref={mapContainerRef}
          className="w-full rounded-lg"
          style={{ height: '400px' }}
        />
      </div>
    </div>
  );
}
