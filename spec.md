# StoryMap

## Current State
- Map view shows story markers; clicking "View Full Story" opens a StoryDetailDialog popup
- When a location is searched, a red search pin is placed and nearby popular stories are highlighted in gold
- Feed view is separate from map view; toggled via sidebar buttons
- `highlightedStoryIds` already computed from searchPin + stories sorted by likes+pins

## Requested Changes (Diff)

### Add
- When user clicks "View Full Story" on a map marker, instead of (or in addition to) opening StoryDetailDialog, switch to Feed view and filter to stories within 5 km of that story's location
- Show a "Viewing stories near [location name or coords]" label above the feed when teleported via map marker click
- A "Clear" / "Back to all stories" button to reset the map-teleport filter

### Modify
- `HomePage.tsx`: add `mapTeleportLocation` state; when a story marker is clicked in Map view, set `mapTeleportLocation` to that story's coordinates, switch viewMode to "feed", and filter the feed to stories within 5 km of that point sorted by most liked + most pinned
- `MapView.tsx`: change the "View Full Story" button popup to dispatch a new `story-location-jump` custom event (with story id + lat/lng) instead of only `story-marker-click`, so HomePage can handle the view switch
- Feed display: when `mapTeleportLocation` is active, show a location banner and apply proximity+popularity sort

### Remove
- Nothing removed

## Implementation Plan
1. In `MapView.tsx`, update the popup button to dispatch both `story-marker-click` (for detail dialog) AND a new `story-location-jump` event carrying `{ id, latitude, longitude, locationName }`
2. In `HomePage.tsx`, add `mapTeleportLocation` state `{ latitude, longitude, label } | null`
3. Listen for `story-location-jump` event in HomePage; on fire: set `mapTeleportLocation`, switch to feed view
4. When `mapTeleportLocation` is set, filter `sortedStories` to within 5 km radius of that point, then sort by likeCount + pinCount desc
5. Show a dismissible banner above the feed: "Showing stories near [label]" with an X to clear `mapTeleportLocation`
6. When `mapTeleportLocation` is cleared, revert to normal feed filtering logic
