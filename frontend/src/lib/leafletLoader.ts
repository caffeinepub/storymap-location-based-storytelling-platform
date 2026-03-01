/**
 * Shared Leaflet and MarkerCluster loader with reference counting
 * to prevent premature removal of global resources while still needed.
 */

interface LoaderState {
  leafletLoaded: boolean;
  clusterLoaded: boolean;
  leafletRefCount: number;
  clusterRefCount: number;
  leafletCSS: HTMLLinkElement | null;
  leafletScript: HTMLScriptElement | null;
  clusterCSS: HTMLLinkElement | null;
  clusterDefaultCSS: HTMLLinkElement | null;
  clusterScript: HTMLScriptElement | null;
  leafletLoadPromise: Promise<any> | null;
  clusterLoadPromise: Promise<void> | null;
  leafletLoadError: Error | null;
  clusterLoadError: Error | null;
}

const state: LoaderState = {
  leafletLoaded: false,
  clusterLoaded: false,
  leafletRefCount: 0,
  clusterRefCount: 0,
  leafletCSS: null,
  leafletScript: null,
  clusterCSS: null,
  clusterDefaultCSS: null,
  clusterScript: null,
  leafletLoadPromise: null,
  clusterLoadPromise: null,
  leafletLoadError: null,
  clusterLoadError: null,
};

export function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window is undefined'));
  }

  state.leafletRefCount++;

  // Already loaded successfully
  if ((window as any).L && state.leafletLoaded && !state.leafletLoadError) {
    return Promise.resolve((window as any).L);
  }

  // Currently loading - return existing promise
  if (state.leafletLoadPromise && !state.leafletLoadError) {
    return state.leafletLoadPromise;
  }

  // Reset error state for retry
  state.leafletLoadError = null;

  // Load for the first time or retry after error
  state.leafletLoadPromise = new Promise((resolve, reject) => {
    // Check if CSS already exists in DOM
    const existingCSS = document.querySelector('link[href*="leaflet"][href*=".css"]');
    if (!state.leafletCSS && !existingCSS) {
      const leafletCSS = document.createElement('link');
      leafletCSS.rel = 'stylesheet';
      leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      leafletCSS.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      leafletCSS.crossOrigin = '';
      
      leafletCSS.onerror = (error) => {
        console.error('Failed to load Leaflet CSS:', error);
        state.leafletLoadError = new Error('Failed to load Leaflet CSS');
        state.leafletLoadPromise = null;
        reject(state.leafletLoadError);
      };
      
      document.head.appendChild(leafletCSS);
      state.leafletCSS = leafletCSS;
    } else if (existingCSS && !state.leafletCSS) {
      state.leafletCSS = existingCSS as HTMLLinkElement;
    }

    // Check if script already exists in DOM
    const existingScript = document.querySelector('script[src*="leaflet"][src*=".js"]');
    if (!state.leafletScript && !existingScript) {
      const leafletScript = document.createElement('script');
      leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      leafletScript.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      leafletScript.crossOrigin = '';
      leafletScript.async = true;
      
      leafletScript.onload = () => {
        if ((window as any).L) {
          state.leafletLoaded = true;
          state.leafletLoadError = null;
          resolve((window as any).L);
        } else {
          const error = new Error('Leaflet loaded but L is undefined');
          state.leafletLoadError = error;
          state.leafletLoadPromise = null;
          reject(error);
        }
      };
      
      leafletScript.onerror = (error) => {
        console.error('Failed to load Leaflet JS:', error);
        state.leafletLoadError = new Error('Failed to load Leaflet JS');
        state.leafletLoadPromise = null;
        reject(state.leafletLoadError);
      };
      
      document.head.appendChild(leafletScript);
      state.leafletScript = leafletScript;
    } else if (existingScript && !state.leafletScript) {
      state.leafletScript = existingScript as HTMLScriptElement;
      // If script already exists, check if L is available
      if ((window as any).L) {
        state.leafletLoaded = true;
        resolve((window as any).L);
      } else {
        // Wait for it to load
        existingScript.addEventListener('load', () => {
          if ((window as any).L) {
            state.leafletLoaded = true;
            resolve((window as any).L);
          } else {
            const error = new Error('Leaflet loaded but L is undefined');
            state.leafletLoadError = error;
            reject(error);
          }
        });
      }
    } else if ((window as any).L) {
      // Already loaded
      state.leafletLoaded = true;
      resolve((window as any).L);
    }
  });

  return state.leafletLoadPromise;
}

export function unloadLeaflet(): void {
  state.leafletRefCount = Math.max(0, state.leafletRefCount - 1);
  // Don't remove resources while still referenced
}

export function loadMarkerCluster(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window is undefined'));
  }

  state.clusterRefCount++;

  // Already loaded successfully
  if ((window as any).L?.markerClusterGroup && state.clusterLoaded && !state.clusterLoadError) {
    return Promise.resolve();
  }

  // Leaflet must be loaded first
  if (!(window as any).L) {
    return Promise.reject(new Error('Leaflet must be loaded before MarkerCluster'));
  }

  // Currently loading - return existing promise
  if (state.clusterLoadPromise && !state.clusterLoadError) {
    return state.clusterLoadPromise;
  }

  // Reset error state for retry
  state.clusterLoadError = null;

  // Load for the first time or retry after error
  state.clusterLoadPromise = new Promise((resolve) => {
    // Check if CSS already exists
    const existingClusterCSS = document.querySelector('link[href*="markercluster"][href*="MarkerCluster.css"]');
    if (!state.clusterCSS && !existingClusterCSS) {
      const clusterCSS = document.createElement('link');
      clusterCSS.rel = 'stylesheet';
      clusterCSS.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
      clusterCSS.crossOrigin = '';
      document.head.appendChild(clusterCSS);
      state.clusterCSS = clusterCSS;
    } else if (existingClusterCSS && !state.clusterCSS) {
      state.clusterCSS = existingClusterCSS as HTMLLinkElement;
    }

    const existingDefaultCSS = document.querySelector('link[href*="markercluster"][href*="Default.css"]');
    if (!state.clusterDefaultCSS && !existingDefaultCSS) {
      const clusterDefaultCSS = document.createElement('link');
      clusterDefaultCSS.rel = 'stylesheet';
      clusterDefaultCSS.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
      clusterDefaultCSS.crossOrigin = '';
      document.head.appendChild(clusterDefaultCSS);
      state.clusterDefaultCSS = clusterDefaultCSS;
    } else if (existingDefaultCSS && !state.clusterDefaultCSS) {
      state.clusterDefaultCSS = existingDefaultCSS as HTMLLinkElement;
    }

    // Check if script already exists
    const existingScript = document.querySelector('script[src*="markercluster"]');
    if (!state.clusterScript && !existingScript) {
      const clusterScript = document.createElement('script');
      clusterScript.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
      clusterScript.async = true;
      clusterScript.crossOrigin = '';
      
      clusterScript.onload = () => {
        state.clusterLoaded = true;
        state.clusterLoadError = null;
        resolve();
      };
      
      clusterScript.onerror = (error) => {
        // Don't reject on error, just log it and resolve anyway
        console.warn('MarkerCluster failed to load, clustering will be disabled:', error);
        state.clusterLoadError = new Error('MarkerCluster load failed');
        state.clusterLoadPromise = null;
        resolve();
      };
      
      document.head.appendChild(clusterScript);
      state.clusterScript = clusterScript;
    } else if (existingScript && !state.clusterScript) {
      state.clusterScript = existingScript as HTMLScriptElement;
      // If script already exists, check if markerClusterGroup is available
      if ((window as any).L?.markerClusterGroup) {
        state.clusterLoaded = true;
        resolve();
      } else {
        // Wait for it to load
        existingScript.addEventListener('load', () => {
          state.clusterLoaded = true;
          resolve();
        });
      }
    } else if ((window as any).L?.markerClusterGroup) {
      // Already loaded
      state.clusterLoaded = true;
      resolve();
    }
  });

  return state.clusterLoadPromise;
}

export function unloadMarkerCluster(): void {
  state.clusterRefCount = Math.max(0, state.clusterRefCount - 1);
  // Don't remove resources while still referenced
}
