import { LayoutGrid, Map as MapIcon, MapPin, X, Zap } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import type { Category, Story } from "../backend";
import CreateStoryDialog from "../components/CreateStoryDialog";
import CreateStoryFAB from "../components/CreateStoryFAB";
import DistanceKmSlider from "../components/DistanceKmSlider";
import FilterBar from "../components/FilterBar";
import MapSearchBar from "../components/MapSearchBar";
import MapView from "../components/MapView";
import SortControl from "../components/SortControl";
import StoryDetailDialog from "../components/StoryDetailDialog";
import StoryFeed from "../components/StoryFeed";
import { Button } from "../components/ui/button";
import { useForegroundLocationTracking } from "../hooks/useForegroundLocationTracking";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useGetCallerUserProfile, useSearchStories } from "../hooks/useQueries";
import { calculateDistance } from "../lib/distanceUtils";
import {
  DEFAULT_PROXIMITY_RADIUS_KM,
  isStoryWithinProximity,
} from "../lib/locationFilter";
import { type LatLng, type SortOption, sortStories } from "../lib/storySorting";

type ViewMode = "feed" | "map";

const TELEPORT_CITIES = [
  { name: "CG Road, Ahmedabad", latitude: 23.0258, longitude: 72.5703 },
  { name: "Manek Chowk, Ahmedabad", latitude: 23.0258, longitude: 72.5873 },
  {
    name: "Sabarmati Riverfront, Ahmedabad",
    latitude: 23.0395,
    longitude: 72.5811,
  },
  { name: "Navrangpura, Ahmedabad", latitude: 23.0331, longitude: 72.5609 },
  { name: "Vastrapur Lake, Ahmedabad", latitude: 23.0386, longitude: 72.5268 },
  { name: "Prahlad Nagar, Ahmedabad", latitude: 23.0153, longitude: 72.5073 },
  { name: "Satellite, Ahmedabad", latitude: 23.0258, longitude: 72.5073 },
  { name: "Bodakdev, Ahmedabad", latitude: 23.0467, longitude: 72.5124 },
  { name: "Thaltej, Ahmedabad", latitude: 23.0572, longitude: 72.4994 },
  { name: "SG Highway, Ahmedabad", latitude: 23.0395, longitude: 72.5009 },
  { name: "Ambawadi, Ahmedabad", latitude: 23.0258, longitude: 72.5521 },
  { name: "Paldi, Ahmedabad", latitude: 23.0015, longitude: 72.5703 },
  { name: "Maninagar, Ahmedabad", latitude: 22.9938, longitude: 72.6097 },
  { name: "Naroda, Ahmedabad", latitude: 23.09, longitude: 72.658 },
  { name: "Chandkheda, Ahmedabad", latitude: 23.1089, longitude: 72.5936 },
  { name: "Gota, Ahmedabad", latitude: 23.0942, longitude: 72.5521 },
  { name: "Motera, Ahmedabad", latitude: 23.0942, longitude: 72.601 },
  { name: "Old City, Ahmedabad", latitude: 23.0258, longitude: 72.5873 },
  { name: "Vejalpur, Ahmedabad", latitude: 22.9938, longitude: 72.5521 },
  { name: "Bopal, Ahmedabad", latitude: 23.0015, longitude: 72.4667 },
  { name: "Ghatlodiya, Ahmedabad", latitude: 23.0724, longitude: 72.5521 },
  { name: "Naranpura, Ahmedabad", latitude: 23.0572, longitude: 72.5703 },
  {
    name: "Iskon Cross Road, Ahmedabad",
    latitude: 23.0258,
    longitude: 72.5073,
  },
  { name: "Sughad, Ahmedabad", latitude: 23.1089, longitude: 72.6228 },
  { name: "Nikol, Ahmedabad", latitude: 23.0572, longitude: 72.658 },
];

export default function HomePage() {
  const { identity: _identity } = useInternetIdentity();
  const { data: _userProfile } = useGetCallerUserProfile();

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [distanceKm, setDistanceKm] = useState<number>(
    DEFAULT_PROXIMITY_RADIUS_KM,
  );
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("feed");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [searchPin, setSearchPin] = useState<{
    latitude: number;
    longitude: number;
    label: string;
  } | null>(null);
  const [mapCenter, setMapCenter] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [mapTeleportLocation, setMapTeleportLocation] = useState<{
    latitude: number;
    longitude: number;
    label: string;
  } | null>(null);

  // Foreground location tracking — returns { latitude, longitude }
  const { location: currentLocation } = useForegroundLocationTracking();

  // Initialize map center to user location when first available
  useEffect(() => {
    if (currentLocation && !mapCenter) {
      setMapCenter(currentLocation);
    }
  }, [currentLocation, mapCenter]);

  // Listen for story-location-jump events dispatched from map marker popups
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const data = JSON.parse(customEvent.detail) as {
        id: string;
        latitude: number;
        longitude: number;
        locationName: string;
      };
      setMapTeleportLocation({
        latitude: data.latitude,
        longitude: data.longitude,
        label:
          data.locationName ||
          `${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`,
      });
      setViewMode("feed");
    };
    window.addEventListener("story-location-jump", handler);
    return () => window.removeEventListener("story-location-jump", handler);
  }, []);

  // Use user's current geolocation as the base location for filtering
  const baseLat = currentLocation?.latitude ?? null;
  const baseLng = currentLocation?.longitude ?? null;

  // Build search params for backend query — always pass the full object shape
  const searchCoordinates: LatLng | null =
    baseLat != null && baseLng != null
      ? { latitude: baseLat, longitude: baseLng }
      : null;

  const { data: rawStories = [], isLoading } = useSearchStories({
    keywords: null,
    category: selectedCategory,
    radius: searchCoordinates ? distanceKm : null,
    coordinates: searchCoordinates,
    sortOption,
    nearestOrigin: searchCoordinates,
  });

  // Client-side distance filter: compare base location against story.latitude/story.longitude
  const filteredStories = React.useMemo(() => {
    if (baseLat == null || baseLng == null) return rawStories;

    return rawStories.filter((story: Story) => {
      if (
        typeof story.latitude !== "number" ||
        typeof story.longitude !== "number"
      ) {
        return true;
      }
      return isStoryWithinProximity(
        baseLat,
        baseLng,
        story.latitude,
        story.longitude,
        distanceKm,
      );
    });
  }, [rawStories, baseLat, baseLng, distanceKm]);

  // Client-side sort
  const sortedStories = React.useMemo(() => {
    const locationForSort: LatLng | null =
      baseLat != null && baseLng != null
        ? { latitude: baseLat, longitude: baseLng }
        : null;
    return sortStories(filteredStories, sortOption, locationForSort);
  }, [filteredStories, sortOption, baseLat, baseLng]);

  const locationAvailable = baseLat != null && baseLng != null;

  // Derive stories near a map-clicked location (sorted by likes + pins)
  const teleportFilteredStories = useMemo(() => {
    if (!mapTeleportLocation) return null;
    return sortedStories
      .filter(
        (s: Story) =>
          typeof s.latitude === "number" &&
          typeof s.longitude === "number" &&
          calculateDistance(
            mapTeleportLocation.latitude,
            mapTeleportLocation.longitude,
            s.latitude,
            s.longitude,
          ) <= 5,
      )
      .sort(
        (a: Story, b: Story) =>
          Number(b.likeCount) +
          Number(b.pinCount) -
          (Number(a.likeCount) + Number(a.pinCount)),
      );
  }, [mapTeleportLocation, sortedStories]);

  // Derive top nearby popular stories when a search pin is active
  const highlightedStoryIds = useMemo(() => {
    if (!searchPin) return null;
    const nearby = sortedStories
      .filter(
        (story: Story) =>
          typeof story.latitude === "number" &&
          typeof story.longitude === "number" &&
          calculateDistance(
            searchPin.latitude,
            searchPin.longitude,
            story.latitude,
            story.longitude,
          ) <= 5,
      )
      .sort(
        (a: Story, b: Story) =>
          Number(b.likeCount) +
          Number(b.pinCount) -
          (Number(a.likeCount) + Number(a.pinCount)),
      )
      .slice(0, 10);
    return nearby.length > 0 ? new Set(nearby.map((s: Story) => s.id)) : null;
  }, [searchPin, sortedStories]);

  function handleTeleport() {
    const city =
      TELEPORT_CITIES[Math.floor(Math.random() * TELEPORT_CITIES.length)];
    setMapTeleportLocation({
      latitude: city.latitude,
      longitude: city.longitude,
      label: city.name,
    });
    setViewMode("feed");
  }

  function handleSeeAllStoriesNear() {
    if (!searchPin) return;
    setMapTeleportLocation({
      latitude: searchPin.latitude,
      longitude: searchPin.longitude,
      label: searchPin.label,
    });
    setViewMode("feed");
  }

  // ── Normal home view ──
  return (
    <div className="flex min-h-0 flex-1">
      {/* ── Left Sidebar ── */}
      <aside className="hidden lg:flex flex-col gap-5 w-72 xl:w-80 shrink-0 border-r border-border bg-card px-5 py-6 overflow-y-auto">
        {/* Teleport Button */}
        <Button
          variant="secondary"
          className="w-full gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900 dark:border-indigo-800"
          onClick={handleTeleport}
          data-ocid="sidebar.teleport_button"
        >
          <Zap className="w-4 h-4" />
          Teleport in Ahmedabad
        </Button>

        <div className="border-t border-border" />

        {/* Category Filters */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Category
          </h3>
          <FilterBar
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        </div>

        <div className="border-t border-border" />

        {/* Distance Slider */}
        <div>
          <DistanceKmSlider
            value={distanceKm}
            onChange={setDistanceKm}
            inactive={!locationAvailable}
            helperText={
              locationAvailable
                ? "Filtering from your current location"
                : "Set a location to enable distance filtering"
            }
          />
        </div>

        <div className="border-t border-border" />

        {/* Sort Control */}
        <div>
          <SortControl
            value={sortOption}
            onChange={setSortOption}
            nearestDisabled={!locationAvailable}
          />
        </div>

        <div className="border-t border-border" />

        {/* Feed / Map Toggle */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            View
          </h3>
          <div className="flex gap-2">
            <Button
              variant={viewMode === "feed" ? "default" : "outline"}
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => setViewMode("feed")}
            >
              <LayoutGrid className="w-4 h-4" />
              Feed
            </Button>
            <Button
              variant={viewMode === "map" ? "default" : "outline"}
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => setViewMode("map")}
            >
              <MapIcon className="w-4 h-4" />
              Map
            </Button>
          </div>
        </div>
      </aside>

      {/* ── Right Main Section ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">
        {/* Mobile filter bar (visible on small screens) */}
        <div className="lg:hidden flex flex-wrap items-center gap-2 px-4 pt-4 pb-2 border-b border-border">
          <FilterBar
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
          <div className="flex gap-2 ml-auto">
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900 dark:border-indigo-800"
              onClick={handleTeleport}
            >
              <Zap className="w-4 h-4" />
              Teleport
            </Button>
            <Button
              variant={viewMode === "feed" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("feed")}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "map" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("map")}
            >
              <MapIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Location status bar */}
        {!locationAvailable && (
          <div className="flex items-center gap-2 px-4 lg:px-6 py-3 border-b border-border">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              Enable location to filter stories by distance
            </span>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 px-4 lg:px-6 py-5">
          {viewMode === "feed" ? (
            <>
              {mapTeleportLocation && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg text-sm">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  <span className="flex-1 text-primary font-medium">
                    Showing popular stories near: {mapTeleportLocation.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMapTeleportLocation(null)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear location filter"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <StoryFeed
                stories={teleportFilteredStories ?? sortedStories}
                isLoading={isLoading}
                userLocation={currentLocation}
                teleportedLocation={null}
                onStoryClick={(story) => setSelectedStory(story)}
                emptyMessage={
                  teleportFilteredStories
                    ? "No stories found near this location yet. Be the first to write one!"
                    : locationAvailable
                      ? `No stories found within ${distanceKm} km${selectedCategory ? " in this category" : ""}.`
                      : "No stories found. Enable location to see nearby stories."
                }
              />
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <MapSearchBar
                onResult={(result) => {
                  setSearchPin(result);
                  setMapCenter({
                    latitude: result.latitude,
                    longitude: result.longitude,
                  });
                }}
                onClear={() => {
                  setSearchPin(null);
                  setMapCenter(currentLocation ?? null);
                }}
                activeLabel={searchPin?.label ?? null}
              />
              {searchPin && (
                <Button
                  variant="secondary"
                  className="w-full gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900 dark:border-indigo-800"
                  onClick={handleSeeAllStoriesNear}
                  data-ocid="map.see_all_stories.button"
                >
                  <LayoutGrid className="w-4 h-4" />
                  See all stories near this location
                </Button>
              )}
              <div className="h-[calc(100vh-270px)] min-h-[400px] rounded-lg overflow-hidden border border-border">
                <MapView
                  stories={sortedStories}
                  userLocation={currentLocation}
                  onStoryClick={(story) => setSelectedStory(story)}
                  selectedLocation={null}
                  centerCoordinate={mapCenter}
                  isVisible={viewMode === "map"}
                  searchPin={searchPin}
                  highlightedStoryIds={highlightedStoryIds}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create story FAB */}
      <CreateStoryFAB onClick={() => setIsCreateOpen(true)} />

      {/* Create story dialog */}
      <CreateStoryDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />

      {/* Story detail dialog — opened by feed card clicks AND map marker clicks */}
      <StoryDetailDialog
        story={selectedStory}
        open={!!selectedStory}
        onOpenChange={(open) => {
          if (!open) setSelectedStory(null);
        }}
        userLocation={currentLocation}
        onStoryDeleted={() => setSelectedStory(null)}
      />
    </div>
  );
}
