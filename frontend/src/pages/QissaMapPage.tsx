import { useState, useEffect, useRef, useCallback } from 'react';
import { useGeolocationPermission } from '../hooks/useGeolocationPermission';
import { useGetNearbyStoriesForMap } from '../hooks/useQueries';
import { getLocationCopy } from '../lib/locationPermissionCopy';
import QissaMapView from '../components/QissaMapView';
import QissaMapSearchBar from '../components/QissaMapSearchBar';
import StoryDetailDialog from '../components/StoryDetailDialog';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';
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

const DEFAULT_CENTER: LatLng = { latitude: 40.7128, longitude: -74.0060 };
const DEFAULT_RADIUS_KM = 5;
const SEARCH_RADIUS_KM = 15;
const MAX_POPULAR_STORIES = 8;

export default function QissaMapPage() {
  const {
    permissionState,
    location: userLocation,
    isRequesting,
    lastErrorReason,
    requestLocation,
  } = useGeolocationPermission();

  const [activeCenter, setActiveCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [isStoryDialogOpen, setIsStoryDialogOpen] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchedLocation, setSearchedLocation] = useState<SearchedLocation | null>(null);
  const [searchCenter, setSearchCenter] = useState<LatLng | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Update active center when user location becomes available
  useEffect(() => {
    if (userLocation && !searchedLocation) {
      setActiveCenter(userLocation);
    }
  }, [userLocation, searchedLocation]);

  // Auto-request location on mount
  useEffect(() => {
    if (permissionState === 'unknown' || permissionState === 'prompt') {
      requestLocation().catch(() => {
        // Error already handled by hook
      });
    }
  }, [permissionState, requestLocation]);

  // Fetch stories for the current map center (default behavior)
  const { data: nearbyStories = [], isLoading: storiesLoading } = useGetNearbyStoriesForMap(
    activeCenter,
    DEFAULT_RADIUS_KM
  );

  // Fetch stories near the searched location (wider radius for popular stories)
  const { data: searchAreaStories = [], isLoading: searchStoriesLoading } = useGetNearbyStoriesForMap(
    searchCenter ?? activeCenter,
    searchCenter ? SEARCH_RADIUS_KM : DEFAULT_RADIUS_KM
  );

  // Derive popular stories from search area: sort by likes+pins, take top N
  const popularStories: Story[] = searchCenter
    ? [...searchAreaStories]
        .sort((a, b) => {
          const scoreA = Number(a.likeCount) + Number(a.pinCount) * 2;
          const scoreB = Number(b.likeCount) + Number(b.pinCount) * 2;
          return scoreB - scoreA;
        })
        .slice(0, MAX_POPULAR_STORIES)
    : [];

  const permissionCopy = getLocationCopy(permissionState);

  const handleStorySelect = (story: Story) => {
    setSelectedStory(story);
    setIsStoryDialogOpen(true);
  };

  const handleMapCenterChange = (newCenter: LatLng) => {
    setActiveCenter(newCenter);
  };

  // Geocode using Nominatim
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) return;

    setSearchError(null);
    setIsSearching(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

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
        setSearchError('No location found. Try a different search term.');
        setIsSearching(false);
        return;
      }

      const result = data[0];
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);

      if (isNaN(lat) || isNaN(lng)) {
        setSearchError('No location found. Try a different search term.');
        setIsSearching(false);
        return;
      }

      const locationName = result.display_name
        ? result.display_name.split(',').slice(0, 2).join(', ')
        : query;

      const newSearchedLocation: SearchedLocation = {
        latitude: lat,
        longitude: lng,
        name: locationName,
      };

      setSearchedLocation(newSearchedLocation);
      setSearchCenter({ latitude: lat, longitude: lng });
      setActiveCenter({ latitude: lat, longitude: lng });
      setIsSearching(false);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setSearchError('No location found. Try a different search term.');
        setIsSearching(false);
      }
    }
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchQuery('');
    setSearchError(null);
    setSearchedLocation(null);
    setSearchCenter(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // Restore to user location or default
    if (userLocation) {
      setActiveCenter(userLocation);
    }
  }, [userLocation]);

  const showPermissionUI = permissionState === 'denied' ||
                           permissionState === 'insecure' ||
                           permissionState === 'unsupported';

  const isLoadingStories = storiesLoading || searchStoriesLoading;

  // Stories to show on map: if search active, use search area stories; otherwise nearby
  const displayStories = searchCenter ? searchAreaStories : nearbyStories;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Permission Status Banner */}
      {showPermissionUI && (
        <div className="bg-muted border-b p-4">
          <div className="container max-w-4xl mx-auto">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1">{permissionCopy.title}</h3>
                <p className="text-sm text-muted-foreground">{permissionCopy.description}</p>
                {lastErrorReason && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {lastErrorReason}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Location Button */}
      {(permissionState === 'prompt' || permissionState === 'unknown') && !userLocation && (
        <div className="bg-background border-b p-4">
          <div className="container max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {permissionCopy.description}
              </span>
            </div>
            <Button
              onClick={requestLocation}
              disabled={isRequesting}
              size="sm"
            >
              {isRequesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Requesting...
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4 mr-2" />
                  {permissionCopy.action}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Map View */}
      <div className="flex-1 relative">
        {/* Search Bar Overlay */}
        <QissaMapSearchBar
          value={searchQuery}
          onChange={(v) => {
            setSearchQuery(v);
            if (searchError) setSearchError(null);
          }}
          onSearch={handleSearch}
          isSearching={isSearching}
          error={searchError}
          onClear={handleSearchClear}
        />

        <QissaMapView
          userLocation={userLocation}
          stories={displayStories}
          center={activeCenter}
          onStorySelect={handleStorySelect}
          onCenterChange={handleMapCenterChange}
          isLoading={isLoadingStories}
          searchedLocation={searchedLocation}
          popularStories={popularStories}
        />
      </div>

      {/* Story Detail Dialog */}
      <StoryDetailDialog
        story={selectedStory}
        open={isStoryDialogOpen}
        onOpenChange={setIsStoryDialogOpen}
        userLocation={userLocation}
        onStoryDeleted={() => {
          setIsStoryDialogOpen(false);
          setSelectedStory(null);
        }}
      />
    </div>
  );
}
