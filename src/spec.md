# Specification

## Summary
**Goal:** Let users optionally add and persist a human-readable location name when creating, saving drafts of, and publishing stories.

**Planned changes:**
- Add an optional “Location name” text input (English label + placeholder) to the Share Your Story (CreateStoryDialog) form, editable regardless of how coordinates are selected.
- Extend the Story data model and create-story API to accept, store, and return an optional `locationName` alongside coordinates.
- Extend the StoryDraft model and draft save/load/publish flows to persist and restore the optional `locationName` value in the dialog.
- Add a backend migration/compatibility update so existing stored stories and drafts remain readable, with `locationName` defaulting to null/empty.

**User-visible outcome:** In the Share Your Story dialog, users can optionally enter a location name (e.g., “Central Park”), submit stories with or without it, and have the value preserved in drafts and published stories.
