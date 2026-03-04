import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Info,
  List,
  Map as MapIcon,
  MapPin,
  RefreshCw,
  Settings,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { LocalUpdatePublic } from "../backend";
import CreateLocalUpdateDialog from "../components/local-updates/CreateLocalUpdateDialog";
import LocalUpdateDetailDialog from "../components/local-updates/LocalUpdateDetailDialog";
import LocalUpdateSettingsDialog from "../components/local-updates/LocalUpdateSettingsDialog";
import LocalUpdatesFAB from "../components/local-updates/LocalUpdatesFAB";
import LocalUpdatesList from "../components/local-updates/LocalUpdatesList";
import LocalUpdatesMapView from "../components/local-updates/LocalUpdatesMapView";
import { useForegroundLocationTracking } from "../hooks/useForegroundLocationTracking";
import { useGeolocationPermission } from "../hooks/useGeolocationPermission";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useLocalUpdateMuting } from "../hooks/useLocalUpdateMuting";
import { useLocalUpdateNotifications } from "../hooks/useLocalUpdateNotifications";
import { useGetActiveLocalUpdatesByProximity } from "../hooks/useLocalUpdates";
import { getLocationCopy } from "../lib/locationPermissionCopy";

interface LocalUpdatesPageProps {
  onBackHome: () => void;
}

export default function LocalUpdatesPage({
  onBackHome,
}: LocalUpdatesPageProps) {
  const [view, setView] = useState<"list" | "map">("list");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedUpdate, setSelectedUpdate] =
    useState<LocalUpdatePublic | null>(null);

  const { identity } = useInternetIdentity();
  const {
    permissionState,
    location: permissionLocation,
    isRequesting,
    lastErrorReason: _lastErrorReason,
    diagnostics: _diagnostics,
    requestLocation,
    autoFetchIfGranted,
  } = useGeolocationPermission();

  // Use foreground location tracking
  const {
    location: trackedLocation,
    error: trackingError,
    isTracking,
    lastUpdated,
    manualRefresh: _manualRefresh,
  } = useForegroundLocationTracking(permissionState === "granted");

  // Use tracked location if available, otherwise fall back to permission location
  const userLocation = trackedLocation || permissionLocation;

  // Auto-fetch location if already granted
  useEffect(() => {
    autoFetchIfGranted();
  }, [autoFetchIfGranted]);

  // Fetch local updates by proximity
  const { data: updates = [], isLoading } =
    useGetActiveLocalUpdatesByProximity(userLocation);

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
    if (
      !userLocation &&
      permissionState !== "denied" &&
      permissionState !== "unsupported" &&
      permissionState !== "insecure"
    ) {
      try {
        await requestLocation();
      } catch (_error) {
        // Continue to open dialog
      }
    }
    setCreateDialogOpen(true);
  };

  const showLocationPrompt =
    permissionState === "prompt" || permissionState === "unknown";
  const showLocationDenied = permissionState === "denied";
  const showLocationInsecure = permissionState === "insecure";
  const showLocationUnsupported = permissionState === "unsupported";
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
                  className="shrink-0"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                  Local Updates
                </h1>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSettingsDialogOpen(true)}
              >
                <Settings className="h-5 w-5" />
              </Button>
            </div>

            {/* View Toggle */}
            <div className="flex gap-2">
              <Button
                variant={view === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("list")}
                className="flex-1"
              >
                <List className="h-4 w-4 mr-2" />
                List
              </Button>
              <Button
                variant={view === "map" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("map")}
                className="flex-1"
              >
                <MapIcon className="h-4 w-4 mr-2" />
                Map
              </Button>
            </div>

            {/* Location Status */}
            {showLocationPrompt && (
              <Alert>
                <MapPin className="h-4 w-4" />
                <AlertDescription>
                  <p className="text-sm mb-2">{locationCopy.title}</p>
                  <Button
                    onClick={requestLocation}
                    disabled={isRequesting}
                    size="sm"
                    className="w-full"
                  >
                    {isRequesting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Requesting...
                      </>
                    ) : (
                      <>
                        <MapPin className="h-4 w-4 mr-2" />
                        Enable Location
                      </>
                    )}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {showLocationDenied && (
              <Alert variant="destructive">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <p className="text-sm font-semibold mb-1">
                    {locationCopy.title}
                  </p>
                  <p className="text-xs">{locationCopy.description}</p>
                </AlertDescription>
              </Alert>
            )}

            {showLocationInsecure && (
              <Alert variant="destructive">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <p className="text-sm font-semibold mb-1">
                    {locationCopy.title}
                  </p>
                  <p className="text-xs">{locationCopy.description}</p>
                </AlertDescription>
              </Alert>
            )}

            {showLocationUnsupported && (
              <Alert variant="destructive">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <p className="text-sm font-semibold mb-1">
                    {locationCopy.title}
                  </p>
                  <p className="text-xs">{locationCopy.description}</p>
                </AlertDescription>
              </Alert>
            )}

            {/* Tracking Status */}
            {userLocation && isTracking && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>Location tracking active</span>
                {lastUpdated && (
                  <span className="ml-auto">
                    {new Date(lastUpdated).toLocaleTimeString()}
                  </span>
                )}
              </div>
            )}

            {trackingError && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">
                  {trackingError}
                </AlertDescription>
              </Alert>
            )}

            {/* Info Card */}
            <div className="p-3 rounded-lg bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 border">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">
                    Real-time local alerts
                  </p>
                  <p>
                    Get notified about traffic, events, and more happening near
                    you.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            {/* Keep both views mounted but toggle visibility */}
            <div style={{ display: view === "list" ? "block" : "none" }}>
              <LocalUpdatesList
                updates={visibleUpdates}
                userLocation={userLocation}
                onUpdateClick={setSelectedUpdate}
              />
            </div>
            <div style={{ display: view === "map" ? "block" : "none" }}>
              <LocalUpdatesMapView
                updates={visibleUpdates}
                userLocation={userLocation}
                onUpdateClick={setSelectedUpdate}
                isVisible={view === "map"}
              />
            </div>
          </>
        )}
      </main>

      {/* FAB - Only show when authenticated */}
      {identity && <LocalUpdatesFAB onClick={handleCreateClick} />}

      {/* Dialogs */}
      <CreateLocalUpdateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        userLocation={userLocation}
        permissionState={permissionState}
      />

      <LocalUpdateSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
      />

      {selectedUpdate && (
        <LocalUpdateDetailDialog
          update={selectedUpdate}
          userLocation={userLocation}
          open={!!selectedUpdate}
          onOpenChange={(open) => !open && setSelectedUpdate(null)}
        />
      )}
    </div>
  );
}
