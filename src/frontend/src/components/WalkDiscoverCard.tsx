import { MapPin, Navigation, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Story } from "../backend";
import { calculateDistance } from "../lib/distanceUtils";

const NEARBY_RADIUS_M = 500;
const REFRESH_INTERVAL_MS = 20_000;
const MOVE_THRESHOLD_M = 100;

interface WalkDiscoverCardProps {
  stories: Story[];
  userLocation: { latitude: number; longitude: number } | null;
  onActivate: (nearbyStories: Story[]) => void;
  onDismiss: () => void;
  isActive: boolean;
}

function getNearbyStories(stories: Story[], lat: number, lng: number): Story[] {
  return stories
    .filter(
      (s) =>
        typeof s.latitude === "number" &&
        typeof s.longitude === "number" &&
        calculateDistance(lat, lng, s.latitude, s.longitude) * 1000 <=
          NEARBY_RADIUS_M,
    )
    .sort((a, b) => {
      const dA =
        calculateDistance(
          lat,
          lng,
          a.latitude as number,
          a.longitude as number,
        ) * 1000;
      const dB =
        calculateDistance(
          lat,
          lng,
          b.latitude as number,
          b.longitude as number,
        ) * 1000;
      return dA - dB;
    });
}

export default function WalkDiscoverCard({
  stories,
  userLocation,
  onActivate,
  onDismiss,
  isActive,
}: WalkDiscoverCardProps) {
  const [nearbyCount, setNearbyCount] = useState(0);
  const lastRefreshLocation = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    if (!userLocation) return;
    function refresh() {
      if (!userLocation) return;
      const nearby = getNearbyStories(
        stories,
        userLocation.latitude,
        userLocation.longitude,
      );
      setNearbyCount(nearby.length);
      if (isActive) onActivate(nearby);
      lastRefreshLocation.current = userLocation;
    }
    if (lastRefreshLocation.current) {
      const moved =
        calculateDistance(
          lastRefreshLocation.current.latitude,
          lastRefreshLocation.current.longitude,
          userLocation.latitude,
          userLocation.longitude,
        ) * 1000;
      if (moved >= MOVE_THRESHOLD_M) refresh();
    } else {
      refresh();
    }
  }, [userLocation, stories, isActive, onActivate]);

  useEffect(() => {
    if (!userLocation) return;
    const id = setInterval(() => {
      const nearby = getNearbyStories(
        stories,
        userLocation.latitude,
        userLocation.longitude,
      );
      setNearbyCount(nearby.length);
      if (isActive) onActivate(nearby);
      lastRefreshLocation.current = userLocation;
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [userLocation, stories, isActive, onActivate]);

  if (!userLocation) return null;

  const hasStories = nearbyCount > 0;

  function handleClick() {
    if (!userLocation) return;
    const nearby = getNearbyStories(
      stories,
      userLocation.latitude,
      userLocation.longitude,
    );
    setNearbyCount(nearby.length);
    onActivate(nearby);
  }

  return (
    <div
      className={`relative flex items-center gap-3 px-4 py-3 mb-4 rounded-xl border transition-all ${
        isActive
          ? "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-700"
          : "bg-card border-border hover:bg-accent"
      }`}
      data-ocid="walk_discover.card"
    >
      {/* Clickable area (not including dismiss button) */}
      <button
        type="button"
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
        onClick={handleClick}
        aria-label="Walk and Discover nearby stories"
      >
        <span className="shrink-0">
          {hasStories ? (
            <Navigation
              className={`w-5 h-5 ${
                isActive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-primary"
              }`}
            />
          ) : (
            <MapPin className="w-5 h-5 text-muted-foreground" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          {hasStories ? (
            <p
              className={`text-sm font-medium leading-snug ${
                isActive
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-foreground"
              }`}
            >
              📍 <span className="font-semibold">{nearbyCount}</span>{" "}
              {nearbyCount === 1 ? "story" : "stories"} near you within 500
              meters
            </p>
          ) : (
            <p className="text-sm text-muted-foreground leading-snug">
              📍 No stories nearby yet. Be the first to share one.
            </p>
          )}
          {isActive && hasStories && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
              Showing nearest stories · updates every 20s
            </p>
          )}
        </div>
      </button>

      {isActive && (
        <button
          type="button"
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          onClick={onDismiss}
          aria-label="Exit walk mode"
          data-ocid="walk_discover.close_button"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
