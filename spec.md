# Specification

## Summary
**Goal:** Add a working location search feature to the QissaMap page that lets users find a location, pin it on the map, and see popular stories nearby.

**Planned changes:**
- Add a visible search input bar (top-center overlay) on the QissaMap page with Enter key and button submission support
- Integrate the Nominatim geocoding API to resolve typed location names to coordinates
- Show a "No location found" message when the search yields no results
- Pan/fly the map smoothly to the searched location's coordinates upon a successful search
- Place a distinct marker (visually different from story markers) at the searched location; remove it when the search input is cleared
- After a successful search, query for stories near the searched coordinates and rank them by popularity (likes/pins)
- Display up to 5–10 popular nearby stories as floating cards or enriched markers on the map, each showing the story title and category badge/excerpt
- Clicking a floating story card/marker opens the existing StoryDetailDialog for that story

**User-visible outcome:** Users can type a location name into a search bar on the QissaMap page, have the map fly to that location with a pin, and immediately see the most popular stories near that location displayed as floating cards on the map.
