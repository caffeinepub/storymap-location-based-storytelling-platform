import { useEffect, useRef, useState, useCallback } from 'react';
import { loadLeaflet, loadMarkerCluster, unloadLeaflet, unloadMarkerCluster } from '../lib/leafletLoader';
import { useLeafletMapResize } from '../hooks/useLeafletMapResize';
import { calculateDistance, formatDistance } from '../lib/utils';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSearchLocationMarkerIcon } from '../lib/searchLocationMarker';
import { getPopularStoryMarkerIcon } from '../lib/popularStoryMarker';
import type { Story } from '../backend';

/** Simple lat/lng shape used throughout the frontend */
interface LatLng {
  latitude: number;
  longitude: number;
}

interface SearchedLocation {
  latitude: number;
  longitude: number;
  name: string;
}

interface QissaMapViewProps {
  userLocation: LatLng | null;
  stories: Story[];
  center: LatLng;
  onStorySelect: (story: Story) => void;
  onCenterChange: (center: LatLng) => void;
  isLoading?: boolean;
  searchedLocation?: SearchedLocation | null;
  popularStories?: Story[];
}

export default function QissaMapView({
  userLocation,
  stories,
  center,
  onStorySelect,
  onCenterChange,
  isLoading = false,
  searchedLocation = null,
  popularStories = [],
}: QissaMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const moveEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchMarkerRef = useRef<any>(null);
  const popularMarkersLayerRef = useRef<any>(null);

  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tileLayerLoaded, setTileLayerLoaded] = useState(false);
  const [clusteringAvailable, setClusteringAvailable] = useState(false);

  useLeafletMapResize(mapInstanceRef.current, true, []);

  // Load Leaflet and MarkerCluster
  useEffect(() => {
    let mounted = true;

    const initLeaflet = async () => {
      try {
        await loadLeaflet();
        if (!mounted) return;

        setLeafletLoaded(true);
        setLoadError(null);

        try {
          await loadMarkerCluster();
          if (mounted && (window as any).L?.markerClusterGroup) {
            setClusteringAvailable(true);
          }
        } catch (clusterError) {
          console.warn('Clustering unavailable, will use regular markers:', clusterError);
          setClusteringAvailable(false);
        }
      } catch (error) {
        console.error('Failed to load Leaflet:', error);
        if (mounted) {
          setLoadError('Failed to load map library. Please refresh the page.');
        }
      }
    };

    initLeaflet();

    return () => {
      mounted = false;
      unloadLeaflet();
      unloadMarkerCluster();
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current || mapInstanceRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    try {
      const map = L.map(mapContainerRef.current, {
        center: [center.latitude, center.longitude],
        zoom: 13,
        zoomControl: true,
      });

      mapInstanceRef.current = map;

      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      });

      tileLayer.on('load', () => {
        setTileLayerLoaded(true);
      });

      tileLayer.on('tileerror', () => {
        console.warn('Tile layer error');
      });

      tileLayer.addTo(map);
      tileLayerRef.current = tileLayer;

      // Debounced moveend handler
      map.on('moveend', () => {
        if (moveEndTimeoutRef.current) {
          clearTimeout(moveEndTimeoutRef.current);
        }
        moveEndTimeoutRef.current = setTimeout(() => {
          const mapCenter = map.getCenter();
          onCenterChange({
            latitude: mapCenter.lat,
            longitude: mapCenter.lng,
          });
        }, 500);
      });
    } catch (error) {
      console.error('Failed to initialize map:', error);
      setLoadError('Failed to initialize map');
    }

    return () => {
      if (moveEndTimeoutRef.current) {
        clearTimeout(moveEndTimeoutRef.current);
      }
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn('Error removing map:', e);
        }
        mapInstanceRef.current = null;
      }
    };
  }, [leafletLoaded]);

  // Update map center when center prop changes (fly to if search triggered)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const currentCenter = map.getCenter();

    const distance = calculateDistance(
      currentCenter.lat,
      currentCenter.lng,
      center.latitude,
      center.longitude
    );

    if (distance > 0.1) {
      // Use flyTo for smooth animation when searching
      if (searchedLocation &&
          Math.abs(center.latitude - searchedLocation.latitude) < 0.0001 &&
          Math.abs(center.longitude - searchedLocation.longitude) < 0.0001) {
        map.flyTo([center.latitude, center.longitude], 13, {
          animate: true,
          duration: 1.2,
        });
      } else {
        map.setView([center.latitude, center.longitude], map.getZoom(), {
          animate: true,
          duration: 0.5,
        });
      }
    }
  }, [center, searchedLocation]);

  // Render user location marker
  useEffect(() => {
    if (!mapInstanceRef.current || !userLocation) return;

    const L = (window as any).L;
    if (!L) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    const userIcon = L.divIcon({
      className: 'user-location-marker',
      html: `
        <div style="position: relative; width: 20px; height: 20px;">
          <div style="
            position: absolute;
            width: 20px;
            height: 20px;
            background: #3b82f6;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
            animation: pulse 2s infinite;
          "></div>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    const userMarker = L.marker([userLocation.latitude, userLocation.longitude], {
      icon: userIcon,
      zIndexOffset: 1000,
    });

    userMarker.addTo(mapInstanceRef.current);
    userMarkerRef.current = userMarker;

    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    };
  }, [userLocation]);

  // Render searched location marker
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletLoaded) return;

    const L = (window as any).L;
    if (!L) return;

    // Remove existing search marker
    if (searchMarkerRef.current) {
      try {
        searchMarkerRef.current.remove();
      } catch (e) {
        console.warn('Error removing search marker:', e);
      }
      searchMarkerRef.current = null;
    }

    if (!searchedLocation) return;

    try {
      const icon = getSearchLocationMarkerIcon(L, searchedLocation.name);
      const marker = L.marker(
        [searchedLocation.latitude, searchedLocation.longitude],
        { icon, zIndexOffset: 900 }
      );

      marker.bindPopup(
        `<div style="padding: 8px; min-width: 150px;">
          <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px;">📍 ${searchedLocation.name}</div>
          <div style="font-size: 11px; color: #666;">Searched location</div>
        </div>`,
        { maxWidth: 250 }
      );

      marker.addTo(mapInstanceRef.current);
      searchMarkerRef.current = marker;
    } catch (error) {
      console.error('Error rendering search marker:', error);
    }

    return () => {
      if (searchMarkerRef.current) {
        try {
          searchMarkerRef.current.remove();
        } catch (e) {
          console.warn('Error cleaning up search marker:', e);
        }
        searchMarkerRef.current = null;
      }
    };
  }, [searchedLocation, leafletLoaded]);

  // Render popular story markers
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletLoaded) return;

    const L = (window as any).L;
    if (!L) return;

    // Clear existing popular markers
    if (popularMarkersLayerRef.current) {
      try {
        popularMarkersLayerRef.current.clearLayers();
        mapInstanceRef.current.removeLayer(popularMarkersLayerRef.current);
      } catch (e) {
        console.warn('Error clearing popular markers:', e);
      }
      popularMarkersLayerRef.current = null;
    }

    if (!popularStories || popularStories.length === 0) return;

    try {
      const layer = L.layerGroup();

      popularStories.forEach((story, index) => {
        const icon = getPopularStoryMarkerIcon(L, story.category, index);
        const marker = L.marker([story.latitude, story.longitude], {
          icon,
          zIndexOffset: 800,
        });

        const previewText = story.content.length > 80
          ? story.content.substring(0, 80) + '...'
          : story.content;

        const likeCount = Number(story.likeCount);
        const pinCount = Number(story.pinCount);

        const popupContent = `
          <div style="min-width: 200px; max-width: 280px; padding: 8px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              <span style="
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                color: white;
                font-size: 10px;
                font-weight: 700;
                padding: 2px 6px;
                border-radius: 10px;
              ">⭐ Popular</span>
              ${index < 3 ? `<span style="font-size: 10px; color: #9ca3af;">#${index + 1} nearby</span>` : ''}
            </div>
            <h3 style="font-weight: 600; font-size: 13px; margin-bottom: 6px; line-height: 1.3;">${story.title}</h3>
            <p style="font-size: 11px; color: #666; margin-bottom: 8px; line-height: 1.4;">${previewText}</p>
            <div style="display: flex; gap: 8px; font-size: 11px; color: #999; margin-bottom: 8px;">
              <span>❤️ ${likeCount}</span>
              <span>📌 ${pinCount}</span>
            </div>
            <button
              id="popular-story-${story.id}"
              style="
                width: 100%;
                padding: 6px 12px;
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
              "
            >
              Read Full Story
            </button>
          </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 300 });

        marker.on('popupopen', () => {
          const button = document.getElementById(`popular-story-${story.id}`);
          if (button) {
            button.addEventListener('click', () => {
              onStorySelect(story);
            });
          }
        });

        layer.addLayer(marker);
      });

      layer.addTo(mapInstanceRef.current);
      popularMarkersLayerRef.current = layer;
    } catch (error) {
      console.error('Error rendering popular story markers:', error);
    }

    return () => {
      if (popularMarkersLayerRef.current) {
        try {
          popularMarkersLayerRef.current.clearLayers();
          if (mapInstanceRef.current) {
            mapInstanceRef.current.removeLayer(popularMarkersLayerRef.current);
          }
        } catch (e) {
          console.warn('Error cleaning up popular markers:', e);
        }
        popularMarkersLayerRef.current = null;
      }
    };
  }, [popularStories, leafletLoaded, onStorySelect]);

  // Render story markers — uses story.latitude / story.longitude
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletLoaded) return;

    const L = (window as any).L;
    if (!L) return;

    if (markersLayerRef.current) {
      try {
        markersLayerRef.current.clearLayers();
        mapInstanceRef.current.removeLayer(markersLayerRef.current);
      } catch (e) {
        console.warn('Error clearing markers:', e);
      }
      markersLayerRef.current = null;
    }

    if (stories.length === 0) return;

    try {
      const markersLayer = clusteringAvailable && L.markerClusterGroup
        ? L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
          })
        : L.layerGroup();

      const storyIcon = L.icon({
        iconUrl: '/assets/generated/story-marker.dim_48x48.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });

      stories.forEach((story) => {
        const marker = L.marker([story.latitude, story.longitude], {
          icon: storyIcon,
        });

        const distance = userLocation
          ? calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              story.latitude,
              story.longitude
            )
          : null;

        const previewText = story.content.length > 100
          ? story.content.substring(0, 100) + '...'
          : story.content;

        const distanceText = distance !== null
          ? formatDistance(distance)
          : 'Distance unavailable';

        const popupContent = `
          <div style="min-width: 200px; max-width: 300px;">
            <h3 style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">${story.title}</h3>
            <p style="font-size: 12px; color: #666; margin-bottom: 8px; line-height: 1.4;">${previewText}</p>
            <p style="font-size: 11px; color: #999; margin-bottom: 8px;">${distanceText}</p>
            <button 
              id="read-story-${story.id}" 
              style="
                width: 100%;
                padding: 6px 12px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
              "
            >
              Read Full Story
            </button>
          </div>
        `;

        marker.bindPopup(popupContent);

        marker.on('popupopen', () => {
          const button = document.getElementById(`read-story-${story.id}`);
          if (button) {
            button.addEventListener('click', () => {
              onStorySelect(story);
            });
          }
        });

        markersLayer.addLayer(marker);
      });

      markersLayer.addTo(mapInstanceRef.current);
      markersLayerRef.current = markersLayer;
    } catch (error) {
      console.error('Error rendering markers:', error);
    }

    return () => {
      if (markersLayerRef.current) {
        try {
          markersLayerRef.current.clearLayers();
          if (mapInstanceRef.current) {
            mapInstanceRef.current.removeLayer(markersLayerRef.current);
          }
        } catch (e) {
          console.warn('Error cleaning up markers:', e);
        }
        markersLayerRef.current = null;
      }
    };
  }, [stories, leafletLoaded, clusteringAvailable, userLocation, onStorySelect]);

  const handleRetry = () => {
    setLoadError(null);
    window.location.reload();
  };

  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/20">
        <div className="text-center space-y-4 p-8">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <div>
            <h3 className="font-semibold text-lg mb-2">Map Loading Error</h3>
            <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
            <Button onClick={handleRetry} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!leafletLoaded || !tileLayerLoaded) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/20">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainerRef} className="h-full w-full" />

      {isLoading && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border z-[999] flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-medium">Loading stories...</span>
        </div>
      )}

      {!isLoading && stories.length > 0 && !searchedLocation && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border z-[999]">
          <span className="text-sm font-medium">
            {stories.length} {stories.length === 1 ? 'story' : 'stories'} nearby
          </span>
        </div>
      )}

      {/* Search result summary badge */}
      {!isLoading && searchedLocation && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border z-[999] flex items-center gap-2">
          <span className="text-sm font-medium">
            {stories.length} {stories.length === 1 ? 'story' : 'stories'} near <strong>{searchedLocation.name.split(',')[0]}</strong>
          </span>
          {popularStories.length > 0 && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              ⭐ {popularStories.length} popular
            </span>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
