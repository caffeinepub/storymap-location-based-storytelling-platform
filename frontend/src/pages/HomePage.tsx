import React, { useState } from 'react';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useGetCallerUserProfile, useSearchStories } from '../hooks/useQueries';
import { Category, Story } from '../backend';
import StoryFeed from '../components/StoryFeed';
import FilterBar from '../components/FilterBar';
import CreateStoryFAB from '../components/CreateStoryFAB';
import CreateStoryDialog from '../components/CreateStoryDialog';
import DistanceKmSlider from '../components/DistanceKmSlider';
import SortControl from '../components/SortControl';
import MapView from '../components/MapView';
import StoryDetailDialog from '../components/StoryDetailDialog';
import { isStoryWithinProximity, DEFAULT_PROXIMITY_RADIUS_KM } from '../lib/locationFilter';
import { sortStories, SortOption, LatLng } from '../lib/storySorting';
import { useForegroundLocationTracking } from '../hooks/useForegroundLocationTracking';
import { MapPin, Navigation, X, Map, LayoutGrid } from 'lucide-react';
import { Button } from '../components/ui/button';
import LocationPickerDialog from '../components/LocationPickerDialog';

// Teleport location uses the same { latitude, longitude } shape as the rest of the app
interface TeleportLocation {
  latitude: number;
  longitude: number;
  label?: string;
}

interface HomePageProps {
  teleportedLocation?: TeleportLocation | null;
  onTeleportLocation?: (loc: TeleportLocation | null) => void;
}

type ViewMode = 'feed' | 'map';

export default function HomePage({ teleportedLocation, onTeleportLocation }: HomePageProps) {
  const { identity } = useInternetIdentity();
  const { data: userProfile } = useGetCallerUserProfile();

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [distanceKm, setDistanceKm] = useState<number>(DEFAULT_PROXIMITY_RADIUS_KM);
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTeleportPickerOpen, setIsTeleportPickerOpen] = useState(false);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);

  // Foreground location tracking — returns { latitude, longitude }
  const { location: currentLocation } = useForegroundLocationTracking();

  // Determine the base location for filtering:
  // - If teleportedLocation is set → use it
  // - Otherwise → use user's current geolocation
  const baseLat = teleportedLocation?.latitude ?? currentLocation?.latitude ?? null;
  const baseLng = teleportedLocation?.longitude ?? currentLocation?.longitude ?? null;

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
      if (typeof story.latitude !== 'number' || typeof story.longitude !== 'number') {
        return true;
      }
      return isStoryWithinProximity(baseLat, baseLng, story.latitude, story.longitude, distanceKm);
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

  const handleTeleportConfirm = (loc: { latitude: number; longitude: number }) => {
    onTeleportLocation?.({ latitude: loc.latitude, longitude: loc.longitude });
    setIsTeleportPickerOpen(false);
  };

  const handleTeleportCancel = () => {
    setIsTeleportPickerOpen(false);
  };

  return (
    <div className="flex min-h-0 flex-1">
      {/* ── Left Sidebar ── */}
      <aside className="hidden lg:flex flex-col gap-5 w-72 xl:w-80 shrink-0 border-r border-border bg-card px-5 py-6 overflow-y-auto">
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
                ? teleportedLocation
                  ? 'Filtering from teleported location'
                  : 'Filtering from your current location'
                : 'Set a location to enable distance filtering'
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
              variant={viewMode === 'feed' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => setViewMode('feed')}
            >
              <LayoutGrid className="w-4 h-4" />
              Feed
            </Button>
            <Button
              variant={viewMode === 'map' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => setViewMode('map')}
            >
              <Map className="w-4 h-4" />
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
              variant={viewMode === 'feed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('feed')}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'map' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('map')}
            >
              <Map className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Top bar: teleport button + location status */}
        <div className="flex items-center justify-between gap-3 px-4 lg:px-6 py-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            {!locationAvailable && !teleportedLocation && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />
                Enable location or teleport to filter by distance
              </span>
            )}
            {teleportedLocation && (
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-3 py-1.5 text-sm text-primary min-w-0">
                <Navigation className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {teleportedLocation.label
                    ? `Teleported: ${teleportedLocation.label}`
                    : `Teleported (${teleportedLocation.latitude.toFixed(3)}, ${teleportedLocation.longitude.toFixed(3)})`}
                </span>
                <button
                  onClick={() => onTeleportLocation?.(null)}
                  className="ml-1 hover:text-destructive transition-colors shrink-0"
                  aria-label="Clear teleport location"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Teleport button — top right */}
          {!teleportedLocation && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-1.5 shrink-0"
              onClick={() => setIsTeleportPickerOpen(true)}
            >
              <Navigation className="w-3.5 h-3.5" />
              Teleport to Location
            </Button>
          )}
          {teleportedLocation && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-1.5 shrink-0"
              onClick={() => setIsTeleportPickerOpen(true)}
            >
              <Navigation className="w-3.5 h-3.5" />
              Change Location
            </Button>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 px-4 lg:px-6 py-5">
          {viewMode === 'feed' ? (
            <StoryFeed
              stories={sortedStories}
              isLoading={isLoading}
              userLocation={currentLocation}
              teleportedLocation={teleportedLocation ?? null}
              emptyMessage={
                locationAvailable
                  ? `No stories found within ${distanceKm} km${selectedCategory ? ` in this category` : ''}.`
                  : 'No stories found. Enable location or teleport to see nearby stories.'
              }
            />
          ) : (
            <div className="h-[calc(100vh-220px)] min-h-[400px] rounded-lg overflow-hidden border border-border">
              <MapView
                stories={sortedStories}
                userLocation={currentLocation}
                onStoryClick={(story) => setSelectedStory(story)}
                selectedLocation={teleportedLocation ?? null}
                centerCoordinate={teleportedLocation ?? currentLocation ?? null}
                isVisible={viewMode === 'map'}
              />
            </div>
          )}
        </div>
      </div>

      {/* Create story FAB */}
      <CreateStoryFAB onClick={() => setIsCreateOpen(true)} />

      {/* Create story dialog */}
      <CreateStoryDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

      {/* Teleport location picker */}
      <LocationPickerDialog
        open={isTeleportPickerOpen}
        onOpenChange={setIsTeleportPickerOpen}
        initialLocation={
          teleportedLocation
            ? { latitude: teleportedLocation.latitude, longitude: teleportedLocation.longitude }
            : currentLocation ?? undefined
        }
        onConfirm={handleTeleportConfirm}
        onCancel={handleTeleportCancel}
      />

      {/* Story detail dialog (for map view clicks) */}
      {selectedStory && (
        <StoryDetailDialog
          story={selectedStory}
          open={!!selectedStory}
          onOpenChange={(open) => { if (!open) setSelectedStory(null); }}
          userLocation={currentLocation}
        />
      )}
    </div>
  );
}
