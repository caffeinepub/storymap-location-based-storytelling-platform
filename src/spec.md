# Specification

## Summary
**Goal:** Make MapView behave more like Google Maps by dropping a single temporary pin on map click and showing the selected coordinates.

**Planned changes:**
- Update the Leaflet MapView to place a temporary marker at the clicked latitude/longitude when the user clicks on the map (excluding clicks on existing story markers).
- Ensure subsequent map clicks move the same temporary marker (no multiple temporary markers left behind).
- Display the selected latitude and longitude in English after a click (e.g., via a small Leaflet popup or a compact UI element under the map) and keep it updated as the user clicks new locations.
- Preserve existing story marker interactions (selecting a story and its popup behavior remains unchanged).

**User-visible outcome:** Users can click anywhere on the map to drop/move a temporary pin and immediately see the clicked latitude/longitude, while existing story markers continue to work as before.
