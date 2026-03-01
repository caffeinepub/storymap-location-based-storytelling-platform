import { useState, useEffect } from 'react';
import { useGeolocationPermission } from '../hooks/useGeolocationPermission';
import { useGetNearbyStoriesForMap } from '../hooks/useQueries';
import { getLocationCopy } from '../lib/locationPermissionCopy';
import QissaMapView from '../components/QissaMapView';
import StoryDetailDialog from '../components/StoryDetailDialog';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';
import type { Story } from '../backend';

/** Simple lat/lng shape used throughout the frontend */
interface LatLng {
  latitude: number;
  longitude: number;
}

const DEFAULT_CENTER: LatLng = { latitude: 40.7128, longitude: -74.0060 };
const DEFAULT_RADIUS_KM = 5;

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

  // Update active center when user location becomes available
  useEffect(() => {
    if (userLocation) {
      setActiveCenter(userLocation);
    }
  }, [userLocation]);

  // Auto-request location on mount
  useEffect(() => {
    if (permissionState === 'unknown' || permissionState === 'prompt') {
      requestLocation().catch(() => {
        // Error already handled by hook
      });
    }
  }, [permissionState, requestLocation]);

  const { data: stories = [], isLoading: storiesLoading } = useGetNearbyStoriesForMap(
    activeCenter,
    DEFAULT_RADIUS_KM
  );

  const permissionCopy = getLocationCopy(permissionState);

  const handleStorySelect = (story: Story) => {
    setSelectedStory(story);
    setIsStoryDialogOpen(true);
  };

  const handleMapCenterChange = (newCenter: LatLng) => {
    setActiveCenter(newCenter);
  };

  const showPermissionUI = permissionState === 'denied' ||
                           permissionState === 'insecure' ||
                           permissionState === 'unsupported';

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
        <QissaMapView
          userLocation={userLocation}
          stories={stories}
          center={activeCenter}
          onStorySelect={handleStorySelect}
          onCenterChange={handleMapCenterChange}
          isLoading={storiesLoading}
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
