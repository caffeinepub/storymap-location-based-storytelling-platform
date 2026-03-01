import { useState, useEffect, useCallback } from 'react';

export type PermissionState = 'granted' | 'prompt' | 'denied' | 'unknown' | 'unsupported' | 'requesting' | 'insecure';

export interface GeolocationDiagnostics {
  errorCode?: number;
  errorMessage?: string;
  userFriendlyDetail?: string;
}

export interface GeolocationPermissionHook {
  permissionState: PermissionState;
  location: { latitude: number; longitude: number } | null;
  isRequesting: boolean;
  lastErrorReason: string | null;
  diagnostics: GeolocationDiagnostics | null;
  requestLocation: () => Promise<void>;
  autoFetchIfGranted: () => void;
}

// Helper to check if geolocation is blocked by Permissions Policy
function isBlockedByPermissionsPolicy(): boolean {
  try {
    // Check if document.featurePolicy or document.permissionsPolicy exists
    if ('permissionsPolicy' in document) {
      const policy = (document as any).permissionsPolicy;
      if (policy && typeof policy.allowsFeature === 'function') {
        return !policy.allowsFeature('geolocation');
      }
    } else if ('featurePolicy' in document) {
      const policy = (document as any).featurePolicy;
      if (policy && typeof policy.allowsFeature === 'function') {
        return !policy.allowsFeature('geolocation');
      }
    }
  } catch (e) {
    // API not available or error checking
  }
  return false;
}

export function useGeolocationPermission(): GeolocationPermissionHook {
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [lastErrorReason, setLastErrorReason] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<GeolocationDiagnostics | null>(null);

  // Check environment prerequisites
  useEffect(() => {
    // Check secure context first
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setPermissionState('insecure');
      setLastErrorReason('Location requires HTTPS or localhost');
      setDiagnostics({
        userFriendlyDetail: 'Requires HTTPS',
      });
      return;
    }

    // Check geolocation availability
    if (!('geolocation' in navigator)) {
      setPermissionState('unsupported');
      setLastErrorReason('Geolocation is not supported by your browser');
      setDiagnostics({
        userFriendlyDetail: 'Browser not supported',
      });
      return;
    }

    // Check if Permissions API is available
    if ('permissions' in navigator && 'query' in navigator.permissions) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((result) => {
          setPermissionState(result.state as PermissionState);

          // Listen for permission changes
          result.addEventListener('change', () => {
            setPermissionState(result.state as PermissionState);
          });
        })
        .catch(() => {
          // Permissions API not fully supported, fallback to unknown
          setPermissionState('unknown');
        });
    } else {
      setPermissionState('unknown');
    }
  }, []);

  // Re-query permission state after failure
  const recheckPermissionState = useCallback(async () => {
    if ('permissions' in navigator && 'query' in navigator.permissions) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        console.log('Re-checked permission state:', result.state);
        return result.state;
      } catch (error) {
        console.log('Permissions API unavailable, cannot verify state');
        return null;
      }
    }
    return null;
  }, []);

  const requestLocation = useCallback(async () => {
    // Check secure context
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setPermissionState('insecure');
      setLastErrorReason('Location requires HTTPS or localhost');
      setDiagnostics({
        userFriendlyDetail: 'Requires HTTPS',
      });
      return;
    }

    // Check geolocation availability
    if (!('geolocation' in navigator)) {
      setPermissionState('unsupported');
      setLastErrorReason('Geolocation is not supported by your browser');
      setDiagnostics({
        userFriendlyDetail: 'Browser not supported',
      });
      return;
    }

    setIsRequesting(true);
    setPermissionState('requesting');
    setLastErrorReason(null);
    setDiagnostics(null);

    return new Promise<void>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setLocation(newLocation);
          setPermissionState('granted');
          setIsRequesting(false);
          setLastErrorReason(null);
          setDiagnostics(null);
          console.log('Location acquired successfully:', newLocation);
          resolve();
        },
        async (error) => {
          console.error('Geolocation error:', {
            code: error.code,
            message: error.message,
          });
          setIsRequesting(false);

          let errorReason = 'Failed to get location';
          let userFriendlyDetail = '';

          if (error.code === error.PERMISSION_DENIED) {
            // Check if blocked by Permissions Policy
            const isPolicyBlocked = isBlockedByPermissionsPolicy();
            
            if (isPolicyBlocked) {
              // Blocked by site policy
              setPermissionState('prompt');
              errorReason = 'Location blocked by site policy';
              userFriendlyDetail = 'Blocked by site policy or browser settings (code: 1)';
            } else {
              // Re-check actual permission state via Permissions API
              const actualState = await recheckPermissionState();
              
              if (actualState === 'denied') {
                // User explicitly denied
                setPermissionState('denied');
                errorReason = 'Location access denied';
                userFriendlyDetail = 'Permission denied by user';
              } else if (actualState === 'prompt') {
                // User dismissed the prompt without choosing
                setPermissionState('prompt');
                errorReason = 'Location prompt dismissed';
                userFriendlyDetail = 'Permission prompt dismissed';
              } else {
                // Permissions API unavailable or returned something else
                // Don't hard-set to 'denied', keep it as 'prompt' to allow retry
                setPermissionState('prompt');
                errorReason = 'Location access blocked';
                userFriendlyDetail = 'Blocked by browser settings or site policy (code: 1)';
              }
            }
          } else if (error.code === error.TIMEOUT) {
            setPermissionState('prompt');
            errorReason = 'Location request timed out';
            userFriendlyDetail = 'Request timed out (code: 3)';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            setPermissionState('prompt');
            errorReason = 'Location information unavailable';
            userFriendlyDetail = 'Position unavailable (code: 2)';
          }

          const newDiagnostics: GeolocationDiagnostics = {
            errorCode: error.code,
            errorMessage: error.message,
            userFriendlyDetail,
          };

          setDiagnostics(newDiagnostics);
          setLastErrorReason(errorReason);

          console.log('Geolocation diagnostics:', {
            errorCode: error.code,
            errorMessage: error.message,
            permissionState,
            userFriendlyDetail,
          });

          reject(new Error(errorReason));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }, [recheckPermissionState, permissionState]);

  const autoFetchIfGranted = useCallback(() => {
    // Only auto-fetch if permission is already granted
    if (permissionState === 'granted' && !location && !isRequesting) {
      requestLocation().catch(() => {
        // Silent fail for auto-fetch
      });
    }
  }, [permissionState, location, isRequesting, requestLocation]);

  return {
    permissionState,
    location,
    isRequesting,
    lastErrorReason,
    diagnostics,
    requestLocation,
    autoFetchIfGranted,
  };
}
