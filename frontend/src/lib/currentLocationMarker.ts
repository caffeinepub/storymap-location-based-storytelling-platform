/**
 * Shared current-location marker configuration for Leaflet maps.
 * Returns a divIcon configuration with a clean dot + ring design.
 */
export function getCurrentLocationMarkerIcon(L: any) {
  return L.divIcon({
    html: `
      <div class="current-location-marker">
        <div class="current-location-dot"></div>
        <div class="current-location-ring"></div>
      </div>
    `,
    className: 'current-location-marker-container',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}
