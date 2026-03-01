import React, { useState, useEffect } from 'react';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useGetCallerUserProfile, useSearchStories } from '../hooks/useQueries';
import { Category, Story } from '../backend';
import StoryFeed from '../components/StoryFeed';
import FilterBar from '../components/FilterBar';
import CreateStoryFAB from '../components/CreateStoryFAB';
import CreateStoryDialog from '../components/CreateStoryDialog';
import DistanceKmSlider from '../components/DistanceKmSlider';
import SortControl from '../components/SortControl';
import { isStoryWithinProximity, DEFAULT_PROXIMITY_RADIUS_KM } from '../lib/locationFilter';
import { sortStories, SortOption, LatLng } from '../lib/storySorting';
import { useForegroundLocationTracking } from '../hooks/useForegroundLocationTracking';
import { MapPin, Navigation, X } from 'lucide-react';
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

export default function HomePage({ teleportedLocation, onTeleportLocation }: HomePageProps) {
  const { identity } = useInternetIdentity();
  const { data: userProfile } = useGetCallerUserProfile();

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [distanceKm, setDistanceKm] = useState<number>(DEFAULT_PROXIMITY_RADIUS_KM);
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTeleportPickerOpen, setIsTeleportPickerOpen] = useState(false);

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
  // Never use uploader location.
  const filteredStories = React.useMemo(() => {
    if (baseLat == null || baseLng == null) return rawStories;

    return rawStories.filter((story: Story) => {
      if (typeof story.latitude !== 'number' || typeof story.longitude !== 'number') {
        return true; // graceful fallback for stories without coordinates
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
    <div className="flex flex-col gap-4">
      {/* Teleport / location controls */}
      <div className="flex flex-wrap items-center gap-2">
        {teleportedLocation ? (
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-3 py-1.5 text-sm text-primary">
            <Navigation className="w-3.5 h-3.5" />
            <span>
              {teleportedLocation.label
                ? `Teleported: ${teleportedLocation.label}`
                : `Teleported (${teleportedLocation.latitude.toFixed(3)}, ${teleportedLocation.longitude.toFixed(3)})`}
            </span>
            <button
              onClick={() => onTeleportLocation?.(null)}
              className="ml-1 hover:text-destructive transition-colors"
              aria-label="Clear teleport location"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5"
            onClick={() => setIsTeleportPickerOpen(true)}
          >
            <Navigation className="w-3.5 h-3.5" />
            Teleport to Location
          </Button>
        )}

        {!locationAvailable && !teleportedLocation && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            Enable location or teleport to filter by distance
          </span>
        )}
      </div>

      {/* Filter + Sort row */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterBar
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
        <div className="ml-auto">
          <SortControl
            value={sortOption}
            onChange={setSortOption}
            nearestDisabled={!locationAvailable}
          />
        </div>
      </div>

      {/* Distance slider */}
      <DistanceKmSlider
        value={distanceKm}
        onChange={setDistanceKm}
        inactive={!locationAvailable}
        helperText={
          locationAvailable
            ? teleportedLocation
              ? 'Filtering from teleported location'
              : 'Filtering from your current location'
            : 'Set a location above to enable distance filtering'
        }
      />

      {/* Story feed */}
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
    </div>
  );
}
