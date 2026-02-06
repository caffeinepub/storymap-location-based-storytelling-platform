import { useState, useEffect, useCallback, useRef } from 'react';

interface LocationState {
  latitude: number;
  longitude: number;
}

interface UseForegroundLocationTrackingResult {
  location: LocationState | null;
  error: string | null;
  isTracking: boolean;
  lastUpdated: number | null;
  manualRefresh: () => void;
}

export function useForegroundLocationTracking(
  enabled: boolean = true
): UseForegroundLocationTrackingResult {
  const [location, setLocation] = useState<LocationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalIdRef = useRef<number | null>(null);

  const updateLocation = useCallback((position: GeolocationPosition) => {
    setLocation({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    setLastUpdated(Date.now());
    setError(null);
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    console.error('Location tracking error:', err);
    setError(err.message);
    setIsTracking(false);
  }, []);

  const manualRefresh = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      updateLocation,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [updateLocation, handleError]);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) {
      return;
    }

    setIsTracking(true);

    // Try to use watchPosition for continuous tracking
    try {
      const watchId = navigator.geolocation.watchPosition(
        updateLocation,
        (err) => {
          console.warn('watchPosition failed, falling back to polling:', err);
          // Fallback to periodic polling if watchPosition fails
          if (!intervalIdRef.current) {
            intervalIdRef.current = window.setInterval(() => {
              navigator.geolocation.getCurrentPosition(
                updateLocation,
                handleError,
                {
                  enableHighAccuracy: true,
                  timeout: 10000,
                  maximumAge: 30000, // Accept cached position up to 30s old
                }
              );
            }, 30000); // Poll every 30 seconds
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );

      watchIdRef.current = watchId;
    } catch (err) {
      console.error('Failed to start location tracking:', err);
      setError('Failed to start location tracking');
      setIsTracking(false);
    }

    // Cleanup function
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      setIsTracking(false);
    };
  }, [enabled, updateLocation, handleError]);

  return {
    location,
    error,
    isTracking,
    lastUpdated,
    manualRefresh,
  };
}
