# StoryMap

## Current State
Stories are stored with the exact latitude and longitude the author picks on the map. These precise coordinates are used for map markers and feed filtering. There is no location privacy layer — readers could potentially identify an author by the exact pin location of a sensitive story.

## Requested Changes (Diff)

### Add
- `fuzzCoordinates(lat, lng)` utility function that applies a random offset of 200–500 meters in a random direction to the given coordinates. Returns fuzzed `{ lat, lng }`.
- `snapToAreaCenter(lat, lng)` utility function that rounds coordinates to the nearest ~500m grid cell, effectively snapping the pin to a coarse area center.
- Both functions are composed: the final stored coordinates = snapToAreaCenter(fuzzCoordinates(originalLat, originalLng)).

### Modify
- In `CreateStoryDialog.tsx`, before calling `createStory.mutateAsync(...)`, apply the combined privacy transform to `lat` and `lng`. The story is stored and displayed with the fuzzed+snapped coordinates instead of the exact user-picked location.
- The `locationName` field is unaffected — it still shows the user-entered name (e.g. "CG Road").
- Draft save/load is unaffected — drafts store the original picked coordinates (fuzzing is applied only on final publish).

### Remove
- Nothing removed.

## Implementation Plan
1. Create `src/frontend/src/lib/locationPrivacy.ts` with:
   - `fuzzCoordinates(lat, lng, minMeters = 200, maxMeters = 500)`: adds a random bearing offset in the given meter range.
   - `snapToAreaCenter(lat, lng, gridMeters = 500)`: snaps to a 500m grid cell center.
   - `applyLocationPrivacy(lat, lng)`: composes both — returns fuzzed then snapped coordinates.
2. In `CreateStoryDialog.tsx` `handleSubmit`, wrap the final `lat` and `lng` with `applyLocationPrivacy(lat, lng)` before passing to `createStory.mutateAsync`. Apply only when a location was actually picked (skip for 0,0 default).
