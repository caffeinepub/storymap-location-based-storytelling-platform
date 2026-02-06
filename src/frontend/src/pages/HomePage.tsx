import { useState, useEffect } from 'react';
import { useSearchStories, useGetCallerUserProfile, useMarkIntroSeen } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useGeolocationPermission } from '../hooks/useGeolocationPermission';
import StoryFeed from '../components/StoryFeed';
import MapView from '../components/MapView';
import CreateStoryFAB from '../components/CreateStoryFAB';
import CreateStoryDialog from '../components/CreateStoryDialog';
import StoryDetailDialog from '../components/StoryDetailDialog';
import FilterBar from '../components/FilterBar';
import DistanceKmSlider from '../components/DistanceKmSlider';
import SortControl from '../components/SortControl';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { List, Map as MapIcon, MapPin, X, Info } from 'lucide-react';
import type { Category, Story } from '../backend';
import type { SortOption } from '../lib/storySorting';
import { LOCATION_FILTER_RADIUS_KM } from '../lib/locationFilter';
import { getLocationCopy } from '../lib/locationPermissionCopy';

export default function HomePage() {
  const [view, setView] = useState<'feed' | 'map'>('feed');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [hasCheckedFirstTime, setHasCheckedFirstTime] = useState(false);
  const [mapSelectedLocation, setMapSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [hasShownDenialToast, setHasShownDenialToast] = useState(false);
  const [radiusKm, setRadiusKm] = useState(LOCATION_FILTER_RADIUS_KM);
  const [sortOption, setSortOption] = useState<SortOption>('newest');

  const { identity } = useInternetIdentity();
  const { data: userProfile, isLoading: profileLoading } = useGetCallerUserProfile();
  const markIntroSeenMutation = useMarkIntroSeen();

  const {
    permissionState,
    location: userLocation,
    isRequesting,
    lastErrorReason,
    diagnostics,
    requestLocation,
    autoFetchIfGranted,
  } = useGeolocationPermission();

  // Auto-fetch location if already granted (no prompt)
  useEffect(() => {
    autoFetchIfGranted();
  }, [autoFetchIfGranted]);

  // Show denial toast only once per session when user explicitly denies
  useEffect(() => {
    if (permissionState === 'denied' && lastErrorReason && !hasShownDenialToast) {
      setHasShownDenialToast(true);
      // Don't show toast, rely on stable UI messaging instead
    }
  }, [permissionState, lastErrorReason, hasShownDenialToast]);

  // Auto-open create dialog for first-time users
  useEffect(() => {
    if (
      identity &&
      !profileLoading &&
      userProfile &&
      !hasCheckedFirstTime &&
      userProfile.storiesPosted === BigInt(0) &&
      !userProfile.seenIntro
    ) {
      setHasCheckedFirstTime(true);
      setCreateDialogOpen(true);
      markIntroSeenMutation.mutate();
    }
  }, [identity, profileLoading, userProfile, hasCheckedFirstTime, markIntroSeenMutation]);

  // Determine the active distance filter center
  // Priority: map-selected location > user location > none
  const activeFilterCenter = mapSelectedLocation || userLocation || null;
  const filterCenterSource = mapSelectedLocation 
    ? 'map-selection' 
    : userLocation 
    ? 'user-location' 
    : 'none';

  // Determine nearest origin for sorting (same as filter center)
  const nearestOrigin = activeFilterCenter;
  const isNearestAvailable = !!nearestOrigin;

  // Auto-switch away from "nearest" if it becomes unavailable
  useEffect(() => {
    if (sortOption === 'nearest' && !isNearestAvailable) {
      setSortOption('newest');
    }
  }, [sortOption, isNearestAvailable]);

  // Use backend-powered search with sort option
  const { data: stories = [], isLoading } = useSearchStories({
    keywords: null,
    category: selectedCategory,
    radius: activeFilterCenter ? radiusKm : null,
    coordinates: activeFilterCenter,
    sortOption,
    nearestOrigin,
  });

  // Unified location request handler - single source of truth
  const handleRequestLocation = async () => {
    try {
      await requestLocation();
    } catch (error) {
      // Error already handled by hook with diagnostics
      // Don't show additional toast to avoid duplication
    }
  };

  const handleCreateStoryClick = async () => {
    // If location is not available, request it from user gesture
    if (!userLocation && permissionState !== 'denied' && permissionState !== 'unsupported' && permissionState !== 'insecure') {
      try {
        await requestLocation();
        // Success feedback will be shown by dialog if needed
      } catch (error) {
        // Continue to open dialog even if location fails
        // Dialog will handle the denied/manual entry flow
      }
    }
    setCreateDialogOpen(true);
  };

  const handleMapBackgroundClick = (latitude: number, longitude: number) => {
    setMapSelectedLocation({ latitude, longitude });
    // Keep user in map view - don't auto-switch to feed
  };

  const clearLocationFilter = () => {
    setMapSelectedLocation(null);
  };

  const handleStoryDeleted = () => {
    setSelectedStory(null);
  };

  const showLocationPrompt = permissionState === 'prompt' || permissionState === 'unknown';
  const showLocationDenied = permissionState === 'denied';
  const showLocationInsecure = permissionState === 'insecure';
  const showLocationUnsupported = permissionState === 'unsupported';
  const locationCopy = getLocationCopy(permissionState);
  
  // Helper text for distance slider - always show meaningful message
  const getDistanceSliderHelperText = () => {
    if (!activeFilterCenter) {
      return 'Enable location or select a point on the map to filter by distance';
    }
    if (mapSelectedLocation) {
      return `Filtering around selected map location`;
    }
    if (userLocation) {
      return `Filtering around your current location`;
    }
    return '';
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-8rem)] gap-0">
      {/* Sidebar - scrollable on overflow */}
      <aside className="w-full lg:w-80 lg:h-[calc(100vh-8rem)] lg:sticky lg:top-0 border-b lg:border-b-0 lg:border-r bg-background">
        <div className="h-full overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-bold">Filters</h2>
              {(showLocationPrompt || showLocationDenied) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRequestLocation}
                  disabled={isRequesting}
                  className="gap-2"
                >
                  <MapPin className="h-4 w-4" />
                  {isRequesting ? 'Requesting...' : 'Enable Location'}
                </Button>
              )}
            </div>

            {showLocationDenied && (
              <Alert variant="destructive">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm space-y-2">
                  <p className="font-medium">{locationCopy.title}</p>
                  <p>{locationCopy.description}</p>
                  {diagnostics?.userFriendlyDetail && (
                    <p className="text-xs opacity-75">
                      Details: {diagnostics.userFriendlyDetail}
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {showLocationInsecure && (
              <Alert variant="destructive">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm space-y-2">
                  <p className="font-medium">{locationCopy.title}</p>
                  <p>{locationCopy.description}</p>
                </AlertDescription>
              </Alert>
            )}

            {showLocationUnsupported && (
              <Alert variant="destructive">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm space-y-2">
                  <p className="font-medium">{locationCopy.title}</p>
                  <p>{locationCopy.description}</p>
                </AlertDescription>
              </Alert>
            )}

            <FilterBar
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
            />

            {mapSelectedLocation && (
              <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <MapPin className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div className="flex-1 text-sm">
                  <span className="font-medium text-green-900 dark:text-green-100 block">
                    Near selected location
                  </span>
                  <span className="text-green-700 dark:text-green-300 text-xs">
                    (within {radiusKm}km)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearLocationFilter}
                  className="h-8 px-2 text-green-700 hover:text-green-900 dark:text-green-300 dark:hover:text-green-100 hover:bg-green-100 dark:hover:bg-green-900/30"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <DistanceKmSlider
              value={radiusKm}
              onChange={setRadiusKm}
              min={1}
              max={50}
              step={1}
              inactive={!activeFilterCenter}
              helperText={getDistanceSliderHelperText()}
            />

            <SortControl
              value={sortOption}
              onChange={setSortOption}
              nearestDisabled={!isNearestAvailable}
            />

            <div className="pt-2">
              <div className="flex gap-2">
                <Button
                  variant={view === 'feed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setView('feed')}
                  className="flex-1"
                >
                  <List className="h-4 w-4 mr-2" />
                  Feed
                </Button>
                <Button
                  variant={view === 'map' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setView('map')}
                  className="flex-1"
                >
                  <MapIcon className="h-4 w-4 mr-2" />
                  Map
                </Button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto">
        <div className="container px-4 py-6">
          <h2 className="text-2xl font-bold mb-4">
            {view === 'feed' ? 'Story Feed' : 'Story Map'}
          </h2>

          {view === 'feed' ? (
            <StoryFeed
              stories={stories}
              isLoading={isLoading}
              userLocation={userLocation}
              onStoryClick={setSelectedStory}
              isLocationFiltered={!!activeFilterCenter}
            />
          ) : (
            <MapView
              stories={stories}
              userLocation={userLocation}
              onStoryClick={setSelectedStory}
              onMapBackgroundClick={handleMapBackgroundClick}
              selectedLocation={mapSelectedLocation}
            />
          )}
        </div>
      </main>

      {identity && <CreateStoryFAB onClick={handleCreateStoryClick} />}

      <CreateStoryDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        userLocation={userLocation}
        permissionState={permissionState}
        onRequestLocation={handleRequestLocation}
        diagnostics={diagnostics}
      />

      <StoryDetailDialog
        story={selectedStory}
        open={!!selectedStory}
        onOpenChange={(open) => !open && setSelectedStory(null)}
        userLocation={userLocation}
        onStoryDeleted={handleStoryDeleted}
      />
    </div>
  );
}
