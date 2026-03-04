import { MapPin } from "lucide-react";
import React, { useState, useMemo } from "react";
import type { Story } from "../backend";
import QissaMapSearchBar, {
  type SearchedLocation,
} from "../components/QissaMapSearchBar";
import QissaMapView from "../components/QissaMapView";
import { useGetNearbyStoriesForMap } from "../hooks/useQueries";

interface QissaMapPageProps {
  userLocation?: { latitude: number; longitude: number } | null;
  onNavigateHome?: () => void;
}

const DEFAULT_CENTER = { latitude: 28.6139, longitude: 77.209 }; // New Delhi
const MAP_RADIUS_KM = 50;

export default function QissaMapPage({
  userLocation,
  onNavigateHome,
}: QissaMapPageProps) {
  const [searchedLocation, setSearchedLocation] =
    useState<SearchedLocation | null>(null);

  // Base location: searched location takes priority over user location, then default
  const baseLocation = useMemo(() => {
    if (searchedLocation) {
      return {
        latitude: searchedLocation.latitude,
        longitude: searchedLocation.longitude,
      };
    }
    if (userLocation) {
      return userLocation;
    }
    return DEFAULT_CENTER;
  }, [searchedLocation, userLocation]);

  // useGetNearbyStoriesForMap expects (center: LatLng, radiusKm: number)
  const { data: nearbyStories = [], isLoading } = useGetNearbyStoriesForMap(
    baseLocation,
    MAP_RADIUS_KM,
  );

  // Popular stories: sorted by likes + pins descending
  const popularStories = useMemo(() => {
    return [...nearbyStories]
      .sort((a, b) => {
        const scoreA = Number(a.likeCount) + Number(a.pinCount);
        const scoreB = Number(b.likeCount) + Number(b.pinCount);
        return scoreB - scoreA;
      })
      .slice(0, 5);
  }, [nearbyStories]);

  const handleLocationFound = (location: SearchedLocation) => {
    setSearchedLocation(location);
  };

  const handleSearchClear = () => {
    setSearchedLocation(null);
  };

  const handleStoryClick = (_story: Story) => {
    // Story click handled inside QissaMapView via popup
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Search bar overlay */}
      <QissaMapSearchBar
        onLocationFound={handleLocationFound}
        onClear={handleSearchClear}
      />

      {/* "Viewing stories near" label — shown below search bar when a search is active */}
      {searchedLocation && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[999] pointer-events-none">
          <div className="flex items-center gap-1.5 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border border-primary/30 text-primary text-xs font-medium rounded-full px-3 py-1.5 shadow-md whitespace-nowrap max-w-xs">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">
              Viewing stories near:{" "}
              {searchedLocation.displayName.split(",").slice(0, 2).join(",")}
            </span>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        <QissaMapView
          stories={nearbyStories}
          userLocation={userLocation}
          isLoading={isLoading}
          searchedLocation={searchedLocation}
          popularStories={popularStories}
          onStoryClick={handleStoryClick}
          onNavigateHome={onNavigateHome}
        />
      </div>
    </div>
  );
}
