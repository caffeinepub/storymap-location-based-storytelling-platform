# Specification

## Summary
**Goal:** Fix story feed distance filtering so it uses each story's own saved coordinates (pinned map location) rather than any uploader profile location.

**Planned changes:**
- Ensure the `Story` type in `backend/main.mo` includes `latitude` and `longitude` fields that store the pinned map location provided at story creation time, with graceful fallback for existing stories without coordinates.
- Update `CreateStoryDialog.tsx` to pass the map location picker coordinates (not the user's live device geolocation) as the story's latitude and longitude when submitting to the backend.
- Fix the feed distance filtering logic in the frontend so that it uses `teleportedLocation` as the base coordinates when set, otherwise falls back to the user's current geolocation, and compares that base against each story's own `story.latitude` and `story.longitude` via Haversine distance — never using uploader profile location.

**User-visible outcome:** Stories in the feed are correctly filtered by distance from the user's current location (or teleported location), based on where each story was actually pinned on the map.
