# Specification

## Summary
**Goal:** Add a Back button on the Local Updates page that returns the user to the Home view using the existing app-level view state routing.

**Planned changes:**
- Add a user-visible, accessible "Back" (or consistent "Back to Home") button to the Local Updates UI.
- Wire Local Updates to receive an app-level navigation callback and use it to switch the current view to "home" when the Back button is clicked.

**User-visible outcome:** While viewing Local Updates, the user can click a Back button to return to the Home page.
