import { useEffect, useRef, useState } from 'react';
import type { Story } from '../backend';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCategoryLabel, getCategoryColor } from '../lib/categories';
import { calculateDistance, formatDistance } from '../lib/utils';

interface MapViewProps {
  stories: Story[];
  userLocation: { latitude: number; longitude: number } | null;
  onStoryClick: (story: Story) => void;
}

export default function MapView({ stories, userLocation, onStoryClick }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [L, setL] = useState<any>(null);

  // Load Leaflet dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if Leaflet is already loaded
    if ((window as any).L) {
      setL((window as any).L);
      setLeafletLoaded(true);
      return;
    }

    // Load Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);

    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.async = true;
    script.onload = () => {
      setL((window as any).L);
      setLeafletLoaded(true);
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup
      if (link.parentNode) link.parentNode.removeChild(link);
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !L || !mapContainerRef.current || mapInstanceRef.current) return;

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

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [leafletLoaded, L, userLocation]);

  // Update markers when stories or user location changes
  useEffect(() => {
    if (!leafletLoaded || !L || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
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

    // Add story markers
    const bounds: [number, number][] = [];
    stories.forEach((story) => {
      const position: [number, number] = [story.location.latitude, story.location.longitude];
      bounds.push(position);

      const marker = L.marker(position, { icon: storyIcon }).addTo(map);

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
          ${distance ? `<p class="text-xs text-gray-500">${distance} away</p>` : ''}
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

      marker.on('click', () => {
        setSelectedStory(story);
      });

      markersRef.current.push(marker);
    });

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
    }

    // Fit map to bounds if we have markers
    if (bounds.length > 0) {
      const latLngBounds = L.latLngBounds(bounds);
      map.fitBounds(latLngBounds, {
        padding: [50, 50],
        maxZoom: 15,
      });
    }
  }, [leafletLoaded, L, stories, userLocation]);

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

  return (
    <div className="space-y-4">
      <div
        ref={mapContainerRef}
        className="relative w-full h-[600px] rounded-lg border overflow-hidden shadow-lg"
        style={{
          background: 'linear-gradient(to bottom right, oklch(var(--muted)), oklch(var(--background)))',
        }}
      >
        {!leafletLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          </div>
        )}
      </div>

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
            {userLocation && (
              <p className="text-xs text-muted-foreground">
                {formatDistance(
                  calculateDistance(
                    userLocation.latitude,
                    userLocation.longitude,
                    selectedStory.location.latitude,
                    selectedStory.location.longitude
                  )
                )}{' '}
                away
              </p>
            )}
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
