import { useState, useEffect } from 'react';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useGeolocationPermission } from '../hooks/useGeolocationPermission';
import { useForegroundLocationTracking } from '../hooks/useForegroundLocationTracking';
import { useGetActiveLocalUpdatesByProximity } from '../hooks/useLocalUpdates';
import { useLocalUpdateMuting } from '../hooks/useLocalUpdateMuting';
import { useLocalUpdateNotifications } from '../hooks/useLocalUpdateNotifications';
import CreateLocalUpdateDialog from '../components/local-updates/CreateLocalUpdateDialog';
import LocalUpdatesFAB from '../components/local-updates/LocalUpdatesFAB';
import LocalUpdatesList from '../components/local-updates/LocalUpdatesList';
import LocalUpdateDetailDialog from '../components/local-updates/LocalUpdateDetailDialog';
import LocalUpdateSettingsDialog from '../components/local-updates/LocalUpdateSettingsDialog';
import LocalUpdatesMapView from '../components/local-updates/LocalUpdatesMapView';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { List, Map as MapIcon, MapPin, Settings, Info, RefreshCw, ArrowLeft } from 'lucide-react';
import { getLocationCopy } from '../lib/locationPermissionCopy';
import type { LocalUpdatePublic } from '../backend';

interface LocalUpdatesPageProps {
  onBackHome: () => void;
}

export default function LocalUpdatesPage({ onBackHome }: LocalUpdatesPageProps) {
  const [view, setView] = useState<'list' | 'map'>('list');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<LocalUpdatePublic | null>(null);

  const { identity } = useInternetIdentity();
  const {
    permissionState,
    location: permissionLocation,
    isRequesting,
    lastErrorReason,
    diagnostics,
    requestLocation,
    autoFetchIfGranted,
  } = useGeolocationPermission();

  // Use foreground location tracking
  const {
    location: trackedLocation,
    error: trackingError,
    isTracking,
    lastUpdated,
    manualRefresh,
  } = useForegroundLocationTracking(permissionState === 'granted');

  // Use tracked location if available, otherwise fall back to permission location
  const userLocation = trackedLocation || permissionLocation;

  // Auto-fetch location if already granted
  useEffect(() => {
    autoFetchIfGranted();
  }, [autoFetchIfGranted]);

  // Fetch local updates by proximity
  const { data: updates = [], isLoading } = useGetActiveLocalUpdatesByProximity(userLocation);

  // Muting preferences
  const { mutedCategories, isMuted } = useLocalUpdateMuting();

  // Filter out muted categories for display (optional - can show all but not notify)
  const visibleUpdates = updates.filter((update) => !isMuted(update.category));

  // Notifications
  useLocalUpdateNotifications({
    updates,
    userLocation,
    mutedCategories,
    enabled: !!identity && !!userLocation,
  });

  const handleCreateClick = async () => {
    if (!userLocation && permissionState !== 'denied' && permissionState !== 'unsupported' && permissionState !== 'insecure') {
      try {
        await requestLocation();
      } catch (error) {
        // Continue to open dialog
      }
    }
    setCreateDialogOpen(true);
  };

  const showLocationPrompt = permissionState === 'prompt' || permissionState === 'unknown';
  const showLocationDenied = permissionState === 'denied';
  const showLocationInsecure = permissionState === 'insecure';
  const showLocationUnsupported = permissionState === 'unsupported';
  const locationCopy = getLocationCopy(permissionState);

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-8rem)] gap-0">
      {/* Sidebar */}
      <aside className="w-full lg:w-80 lg:h-[calc(100vh-8rem)] lg:sticky lg:top-0 border-b lg:border-b-0 lg:border-r bg-background">
        <div className="h-full overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onBackHome}
                  aria-label="Back to Home"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-xl font-bold">Local Updates</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSettingsDialogOpen(true)}
              >
                <Settings className="h-5 w-5" />
              </Button>
            </div>

            {(showLocationPrompt || showLocationDenied) && (
              <Button
                variant="outline"
                size="sm"
                onClick={requestLocation}
                disabled={isRequesting}
                className="w-full gap-2"
              >
                <MapPin className="h-4 w-4" />
                {isRequesting ? 'Requesting...' : 'Enable Location'}
              </Button>
            )}

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

            {userLocation && (
              <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-900 dark:text-green-100">
                    Location Active
                  </span>
                </div>
                <p className="text-xs text-green-700 dark:text-green-300">
                  {isTracking ? 'Tracking your location' : 'Location available'}
                </p>
                {lastUpdated && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Updated {Math.floor((Date.now() - lastUpdated) / 1000)}s ago
                  </p>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={manualRefresh}
                  className="mt-2 w-full text-green-700 hover:text-green-900 dark:text-green-300 dark:hover:text-green-100"
                >
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Refresh Location
                </Button>
              </div>
            )}

            {trackingError && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {trackingError}
                </AlertDescription>
              </Alert>
            )}

            <div className="pt-2">
              <div className="flex gap-2">
                <Button
                  variant={view === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setView('list')}
                  className="flex-1"
                >
                  <List className="h-4 w-4 mr-2" />
                  List
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

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container px-4 py-6">
          <h2 className="text-2xl font-bold mb-4">
            {view === 'list' ? 'Nearby Updates' : 'Updates Map'}
          </h2>

          {!userLocation && !isLoading && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Enable location access to see local updates near you.
              </AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          )}

          {!isLoading && userLocation && view === 'list' && (
            <LocalUpdatesList
              updates={visibleUpdates}
              userLocation={userLocation}
              onUpdateClick={setSelectedUpdate}
            />
          )}

          {!isLoading && userLocation && view === 'map' && (
            <LocalUpdatesMapView
              updates={visibleUpdates}
              userLocation={userLocation}
              onUpdateClick={setSelectedUpdate}
            />
          )}
        </div>
      </main>

      {identity && <LocalUpdatesFAB onClick={handleCreateClick} />}

      <CreateLocalUpdateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        userLocation={userLocation}
        permissionState={permissionState}
      />

      <LocalUpdateDetailDialog
        update={selectedUpdate}
        open={!!selectedUpdate}
        onOpenChange={(open) => !open && setSelectedUpdate(null)}
        userLocation={userLocation}
      />

      <LocalUpdateSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
      />
    </div>
  );
}
