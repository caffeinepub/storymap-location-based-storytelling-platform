# Specification

## Summary
**Goal:** Show a human-readable place name in each story feed card, and optionally display the distance from the user to that place when user location is available.

**Planned changes:**
- Update Story Feed cards to render a location label resolved from each story’s latitude/longitude, and when user location is available format it as “<X>km away from <Place Name>” (or “<X>m away from <Place Name>” under 1km).
- Add client-side reverse geocoding via OpenStreetMap Nominatim reverse endpoint to turn story coordinates into a place string.
- Implement caching for reverse-geocode lookups (using a stable rounded-coordinates key) and cancel/ignore in-flight requests when cards unmount or coordinates change to avoid wasted work and state updates after unmount.
- Ensure graceful fallback: if geocoding is loading/fails or user location is unavailable, cards continue rendering without errors and show the prior behavior (distance-only if available, otherwise nothing) until/if the place name becomes available.

**User-visible outcome:** In the Story Feed grid, each story card can show a readable location name, and when your location is available it also shows how far away the story is (e.g., “2.3km away from Downtown”).
