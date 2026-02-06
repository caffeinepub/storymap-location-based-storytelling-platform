import { useEffect, useRef, useState } from 'react';
import type { LocalUpdate } from '../../backend';
import { getLocalCategoryLabel, getLocalCategoryIconColor, formatRadius } from '../../lib/localUpdates';
import { formatDistanceValue, calculateDistance } from '../../lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock } from 'lucide-react';

interface LocalUpdatesMapViewProps {
  updates: LocalUpdate[];
  userLocation: { latitude: number; longitude: number } | null;
  onUpdateClick: (update: LocalUpdate) => void;
}

export default function LocalUpdatesMapView({
  updates,
  userLocation,
  onUpdateClick,
}: LocalUpdatesMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [L, setL] = useState<any>(null);
  const [selectedUpdate, setSelectedUpdate] = useState<LocalUpdate | null>(null);

  // Load Leaflet dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ((window as any).L) {
      setL((window as any).L);
      setLeafletLoaded(true);
      return;
    }

    const leafletCSS = document.createElement('link');
    leafletCSS.rel = 'stylesheet';
    leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    leafletCSS.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    leafletCSS.crossOrigin = '';
    document.head.appendChild(leafletCSS);

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
      if (leafletCSS.parentNode) leafletCSS.parentNode.removeChild(leafletCSS);
      if (leafletScript.parentNode) leafletScript.parentNode.removeChild(leafletScript);
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !L || !mapContainerRef.current || mapInstanceRef.current) return;

    const defaultCenter: [number, number] = userLocation
      ? [userLocation.latitude, userLocation.longitude]
      : [40.7128, -74.006];

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 12,
      zoomControl: true,
    });

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

  // Update markers
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

    const bounds: [number, number][] = [];

    // Add update markers
    updates.forEach((update) => {
      const position: [number, number] = [update.latitude, update.longitude];
      bounds.push(position);

      const iconColor = getLocalCategoryIconColor(update.category);

      const updateIcon = L.divIcon({
        html: `
          <div class="relative w-10 h-10 flex items-center justify-center">
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center" style="background-color: ${iconColor}">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
            </div>
          </div>
        `,
        className: 'custom-local-update-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40],
      });

      const marker = L.marker(position, { icon: updateIcon });

      const distance = userLocation
        ? formatDistanceValue(
            calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              update.latitude,
              update.longitude
            )
          )
        : '';

      const timestamp = new Date(Number(update.timestamp) / 1000000);
      const timeAgo = getTimeAgo(timestamp);

      const imageHtml = update.image
        ? `<img src="${update.image.getDirectURL()}" alt="Update" class="w-full h-32 object-cover mb-2 rounded" />`
        : '';

      const popupContent = `
        <div class="p-2 min-w-[200px]">
          ${imageHtml}
          <div class="flex items-start justify-between gap-2 mb-2">
            <span class="text-xs px-2 py-1 rounded-full" style="background-color: ${iconColor}20; color: ${iconColor}">
              ${getLocalCategoryLabel(update.category)}
            </span>
          </div>
          <p class="text-sm font-medium mb-2">${update.content}</p>
          <div class="flex items-center justify-between text-xs text-gray-500 mb-2">
            ${distance ? `<span>${distance} away</span>` : '<span></span>'}
            <span>${timeAgo}</span>
          </div>
          <div class="text-xs text-gray-500 mb-2">
            Radius: ${formatRadius(Number(update.radius))}
          </div>
          <button 
            class="mt-2 w-full px-3 py-1 text-xs text-white rounded-md hover:opacity-90 transition-opacity"
            style="background-color: ${iconColor}"
            onclick="window.dispatchEvent(new CustomEvent('local-update-marker-click', { detail: '${update.id}' }))"
          >
            View Details
          </button>
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup',
      });

      marker.on('click', (e: any) => {
        L.DomEvent.stopPropagation(e);
        setSelectedUpdate(update);
      });

      marker.addTo(map);
      markersRef.current.push(marker);

      // Add radius circle
      const circle = L.circle(position, {
        radius: Number(update.radius),
        color: iconColor,
        fillColor: iconColor,
        fillOpacity: 0.1,
        weight: 2,
      }).addTo(map);
      markersRef.current.push(circle);
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

    // Fit bounds
    if (bounds.length > 0) {
      const latLngBounds = L.latLngBounds(bounds);
      map.fitBounds(latLngBounds, {
        padding: [50, 50],
        maxZoom: 15,
      });
    }
  }, [leafletLoaded, L, updates, userLocation]);

  // Handle marker clicks
  useEffect(() => {
    const handleMarkerClick = (event: any) => {
      const updateId = event.detail;
      const update = updates.find((u) => u.id.toString() === updateId);
      if (update) {
        onUpdateClick(update);
      }
    };

    window.addEventListener('local-update-marker-click', handleMarkerClick);
    return () => {
      window.removeEventListener('local-update-marker-click', handleMarkerClick);
    };
  }, [updates, onUpdateClick]);

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
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          </div>
        )}
      </div>

      {selectedUpdate && (
        <Card className="animate-in slide-in-from-bottom-4 duration-300">
          <CardContent className="pt-6">
            {selectedUpdate.image && (
              <div className="mb-3 rounded-md overflow-hidden">
                <img
                  src={selectedUpdate.image.getDirectURL()}
                  alt="Update"
                  className="w-full h-32 object-cover"
                />
              </div>
            )}
            <div className="flex items-start justify-between gap-4 mb-2">
              <p className="font-medium text-sm">{selectedUpdate.content}</p>
              <Badge variant="secondary">
                {getLocalCategoryLabel(selectedUpdate.category)}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{getTimeAgo(new Date(Number(selectedUpdate.timestamp) / 1000000))}</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>{formatRadius(Number(selectedUpdate.radius))}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <style>{`
        .custom-local-update-marker {
          background: transparent;
          border: none;
        }
        .custom-user-marker {
          background: transparent;
          border: none;
        }
      `}</style>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
