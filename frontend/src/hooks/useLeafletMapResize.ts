import { useEffect, useRef } from 'react';

/**
 * Hook to invalidate Leaflet map size when container becomes visible or resizes.
 * Prevents blank/gray maps when initialized in hidden containers (e.g., dialogs).
 */
export function useLeafletMapResize(
  mapInstance: any | null,
  isVisible: boolean,
  dependencies: any[] = []
) {
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const lastVisibilityRef = useRef<boolean>(isVisible);

  useEffect(() => {
    if (!mapInstance || !isVisible) {
      lastVisibilityRef.current = isVisible;
      return;
    }

    const invalidateMapSize = () => {
      if (mapInstance && typeof mapInstance.invalidateSize === 'function') {
        try {
          mapInstance.invalidateSize({ animate: false });
        } catch (error) {
          console.warn('Error invalidating map size:', error);
        }
      }
    };

    // Invalidate immediately when becoming visible
    if (!lastVisibilityRef.current && isVisible) {
      invalidateMapSize();
    }
    lastVisibilityRef.current = isVisible;

    // Get the map container element
    try {
      const container = mapInstance.getContainer?.();
      if (container) {
        containerRef.current = container;

        // Use ResizeObserver to detect container size changes
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserverRef.current = new ResizeObserver(() => {
            // Use requestAnimationFrame to batch resize operations
            requestAnimationFrame(() => {
              invalidateMapSize();
            });
          });
          resizeObserverRef.current.observe(container);
        }
      }
    } catch (error) {
      console.warn('Error setting up resize observer:', error);
    }

    // Multiple delayed invalidations to handle various animation scenarios
    const timeouts: NodeJS.Timeout[] = [];
    
    // Immediate
    invalidateMapSize();
    
    // After short delay (for CSS transitions)
    timeouts.push(setTimeout(invalidateMapSize, 100));
    
    // After medium delay (for dialog animations)
    timeouts.push(setTimeout(invalidateMapSize, 250));
    
    // After longer delay (for complex animations)
    timeouts.push(setTimeout(invalidateMapSize, 500));

    return () => {
      timeouts.forEach(clearTimeout);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [mapInstance, isVisible, ...dependencies]);
}
