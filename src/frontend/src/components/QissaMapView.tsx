import { Layers, Navigation } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import type { Story } from "../backend";
import type { Category } from "../backend";
import { getCurrentLocationMarkerIcon } from "../lib/currentLocationMarker";
import { loadLeaflet } from "../lib/leafletLoader";
import { getPopularStoryMarkerIcon } from "../lib/popularStoryMarker";
import { getSearchLocationMarkerIcon } from "../lib/searchLocationMarker";
import type { SearchedLocation } from "./QissaMapSearchBar";

interface QissaMapViewProps {
  stories: Story[];
  userLocation?: { latitude: number; longitude: number } | null;
  isLoading?: boolean;
  searchedLocation?: SearchedLocation | null;
  popularStories?: Story[];
  onStoryClick?: (story: Story) => void;
  onNavigateHome?: () => void;
}

const DEFAULT_CENTER: [number, number] = [28.6139, 77.209];
const DEFAULT_ZOOM = 12;
const SEARCH_ZOOM = 13;

export default function QissaMapView({
  stories,
  userLocation,
  isLoading,
  searchedLocation,
  popularStories = [],
  onStoryClick,
  onNavigateHome,
}: QissaMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const storyMarkersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const searchMarkerRef = useRef<any>(null);
  const popularMarkersRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);

  // Initialize map
  // biome-ignore lint/correctness/useExhaustiveDependencies: map initialised once on mount; userLocation handled by separate effect
  useEffect(() => {
    let cancelled = false;

    loadLeaflet().then(() => {
      if (cancelled || !mapContainerRef.current || mapRef.current) return;

      const L = (window as any).L;
      if (!L) return;

      leafletRef.current = L;

      const center: [number, number] = userLocation
        ? [userLocation.latitude, userLocation.longitude]
        : DEFAULT_CENTER;

      const map = L.map(mapContainerRef.current, {
        center,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, []);

  // Update user location marker
  useEffect(() => {
    if (!mapReady || !mapRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    const map = mapRef.current;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const icon = getCurrentLocationMarkerIcon(L);
      userMarkerRef.current = L.marker(
        [userLocation.latitude, userLocation.longitude],
        { icon, zIndexOffset: 1000 },
      ).addTo(map);
    }
  }, [mapReady, userLocation]);

  // Handle searched location: fly to + place marker
  useEffect(() => {
    if (!mapReady || !mapRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    const map = mapRef.current;

    // Remove previous search marker
    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
      searchMarkerRef.current = null;
    }

    if (searchedLocation) {
      const { latitude, longitude, displayName } = searchedLocation;

      // Fly to searched location
      map.flyTo([latitude, longitude], SEARCH_ZOOM, {
        animate: true,
        duration: 1.2,
      });

      // Place temporary marker using the correct factory function
      const icon = getSearchLocationMarkerIcon(L, displayName.split(",")[0]);
      searchMarkerRef.current = L.marker([latitude, longitude], {
        icon,
        zIndexOffset: 2000,
      }).addTo(map);
    }
  }, [mapReady, searchedLocation]);

  // Update story markers
  useEffect(() => {
    if (!mapReady || !mapRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    const map = mapRef.current;

    // Remove old story markers
    for (const m of storyMarkersRef.current) m.remove();
    storyMarkersRef.current = [];

    for (const story of stories) {
      const categoryEmoji: Record<string, string> = {
        love: "❤️",
        confession: "🤫",
        funny: "😄",
        random: "🎲",
        other: "📖",
      };
      const emoji = categoryEmoji[story.category as string] ?? "📖";

      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width:36px;height:36px;border-radius:50% 50% 50% 0;
          background:#6366f1;border:2px solid #fff;
          display:flex;align-items:center;justify-content:center;
          font-size:16px;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.3);
        "><span style="transform:rotate(45deg)">${emoji}</span></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });

      const marker = L.marker([story.latitude, story.longitude], { icon })
        .addTo(map)
        .on("click", () => {
          setSelectedStory(story);
          onStoryClick?.(story);
        });

      storyMarkersRef.current.push(marker);
    }
  }, [mapReady, stories, onStoryClick]);

  // Update popular story markers
  useEffect(() => {
    if (!mapReady || !mapRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    const map = mapRef.current;

    for (const m of popularMarkersRef.current) m.remove();
    popularMarkersRef.current = [];

    let index = 0;
    for (const story of popularStories) {
      const icon = getPopularStoryMarkerIcon(
        L,
        story.category as Category,
        index,
      );
      const marker = L.marker([story.latitude, story.longitude], {
        icon,
        zIndexOffset: 500,
      })
        .addTo(map)
        .on("click", () => {
          setSelectedStory(story);
          onStoryClick?.(story);
        });
      popularMarkersRef.current.push(marker);
      index++;
    }
  }, [mapReady, popularStories, onStoryClick]);

  return (
    <div className="relative w-full h-full min-h-[400px]">
      {/* Map container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/40 backdrop-blur-sm flex items-center justify-center z-[900] pointer-events-none">
          <div className="bg-card rounded-xl px-4 py-3 shadow-lg flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Loading stories…
          </div>
        </div>
      )}

      {/* Story count badge */}
      {mapReady && !isLoading && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[900] pointer-events-none">
          <div className="bg-card/90 backdrop-blur-sm border border-border rounded-full px-3 py-1.5 text-xs text-muted-foreground shadow flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            {stories.length} {stories.length === 1 ? "story" : "stories"} nearby
          </div>
        </div>
      )}

      {/* Navigate home button */}
      {onNavigateHome && (
        <button
          type="button"
          onClick={onNavigateHome}
          className="absolute bottom-12 right-3 z-[900] bg-card border border-border rounded-full p-2 shadow-md hover:bg-accent transition-colors"
          title="Back to feed"
        >
          <Navigation className="w-4 h-4 text-foreground" />
        </button>
      )}

      {/* Selected story popup */}
      {selectedStory && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[950] w-72 pointer-events-auto">
          <div className="bg-card border border-border rounded-xl shadow-xl p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {selectedStory.title}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {selectedStory.content}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStory(null)}
                className="text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5"
              >
                ✕
              </button>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>❤️ {Number(selectedStory.likeCount)}</span>
              <span>📌 {Number(selectedStory.pinCount)}</span>
              <span>👁 {Number(selectedStory.viewCount)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
