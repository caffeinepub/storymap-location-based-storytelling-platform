import { useEffect, useState } from 'react';

/**
 * Hook to invalidate Leaflet map size when container becomes visible or resizes.
 * Prevents blank/gray maps when initialized in hidden containers (e.g., dialogs).
 */
export function useLeafletMapResize(
  mapInstance: any | null,
  isVisible: boolean,
  dependencies: any[] = []
) {
  const [lastMapInstance, setLastMapInstance] = useState<any>(null);

  // Track when mapInstance changes to trigger resize
  useEffect(() => {
    if (mapInstance !== lastMapInstance) {
      setLastMapInstance(mapInstance);
    }
  }, [mapInstance, lastMapInstance]);

  useEffect(() => {
    if (!mapInstance || !isVisible) return;

    // Invalidate immediately
    if (typeof mapInstance.invalidateSize === 'function') {
      mapInstance.invalidateSize();
    }

    // Also invalidate after a short delay to handle any animations
    const timeoutId1 = setTimeout(() => {
      if (mapInstance && typeof mapInstance.invalidateSize === 'function') {
        mapInstance.invalidateSize();
      }
    }, 150);

    // Additional delayed invalidate for dialog scenarios
    const timeoutId2 = setTimeout(() => {
      if (mapInstance && typeof mapInstance.invalidateSize === 'function') {
        mapInstance.invalidateSize();
      }
    }, 350);

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
    };
  }, [mapInstance, isVisible, lastMapInstance, ...dependencies]);
}
