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
};

export function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window is undefined'));
  }

  state.leafletRefCount++;

  // Already loaded
  if ((window as any).L && state.leafletLoaded) {
    return Promise.resolve((window as any).L);
  }

  // Currently loading - return existing promise
  if (state.leafletLoadPromise) {
    return state.leafletLoadPromise;
  }

  // Load for the first time
  state.leafletLoadPromise = new Promise((resolve, reject) => {
    if (!state.leafletCSS) {
      const leafletCSS = document.createElement('link');
      leafletCSS.rel = 'stylesheet';
      leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      leafletCSS.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      leafletCSS.crossOrigin = '';
      document.head.appendChild(leafletCSS);
      state.leafletCSS = leafletCSS;
    }

    if (!state.leafletScript) {
      const leafletScript = document.createElement('script');
      leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      leafletScript.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      leafletScript.crossOrigin = '';
      leafletScript.async = true;
      leafletScript.onload = () => {
        state.leafletLoaded = true;
        resolve((window as any).L);
      };
      leafletScript.onerror = (error) => {
        state.leafletLoadPromise = null; // Reset promise on error
        reject(error);
      };
      document.head.appendChild(leafletScript);
      state.leafletScript = leafletScript;
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

  // Already loaded
  if ((window as any).L?.markerClusterGroup && state.clusterLoaded) {
    return Promise.resolve();
  }

  // Leaflet must be loaded first
  if (!(window as any).L) {
    return Promise.reject(new Error('Leaflet must be loaded before MarkerCluster'));
  }

  // Currently loading - return existing promise
  if (state.clusterLoadPromise) {
    return state.clusterLoadPromise;
  }

  // Load for the first time
  state.clusterLoadPromise = new Promise((resolve) => {
    if (!state.clusterCSS) {
      const clusterCSS = document.createElement('link');
      clusterCSS.rel = 'stylesheet';
      clusterCSS.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
      document.head.appendChild(clusterCSS);
      state.clusterCSS = clusterCSS;
    }

    if (!state.clusterDefaultCSS) {
      const clusterDefaultCSS = document.createElement('link');
      clusterDefaultCSS.rel = 'stylesheet';
      clusterDefaultCSS.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
      document.head.appendChild(clusterDefaultCSS);
      state.clusterDefaultCSS = clusterDefaultCSS;
    }

    if (!state.clusterScript) {
      const clusterScript = document.createElement('script');
      clusterScript.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
      clusterScript.async = true;
      clusterScript.onload = () => {
        state.clusterLoaded = true;
        resolve();
      };
      clusterScript.onerror = (error) => {
        // Don't reject on error, just log it and resolve anyway
        console.warn('MarkerCluster failed to load, clustering will be disabled:', error);
        state.clusterLoadPromise = null; // Reset promise on error
        resolve();
      };
      document.head.appendChild(clusterScript);
      state.clusterScript = clusterScript;
    }
  });

  return state.clusterLoadPromise;
}

export function unloadMarkerCluster(): void {
  state.clusterRefCount = Math.max(0, state.clusterRefCount - 1);
  // Don't remove resources while still referenced
}
