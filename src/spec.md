# Specification

## Summary
**Goal:** Remove the background wallpaper feature from the UI and fully disable wallpaper rendering/persistence across the app.

**Planned changes:**
- Remove the “Background wallpaper” control from the app header (do not render the wallpaper settings dialog trigger/button).
- Disable wallpaper application/rendering in the app layout (stop rendering wallpaper background/overlay layers).
- On app load, clear any persisted wallpaper value from localStorage so older wallpapers no longer appear.
- Delete unused wallpaper-related frontend components/hooks/styles and remove unreferenced wallpaper CSS selectors.

**User-visible outcome:** Users no longer see any “Background wallpaper” option, and the app never shows a custom wallpaper background (including previously saved wallpapers).
