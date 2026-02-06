# Specification

## Summary
**Goal:** Restore successful production deployment and add optional image upload support to Local Updates end-to-end (backend model/API + frontend create and display flows).

**Planned changes:**
- Identify and fix the root cause(s) of the current production deployment failure so both the frontend TypeScript/Vite build and backend Motoko canister build/deploy succeed.
- Extend the backend LocalUpdate data model and addLocalUpdate API to include an optional image using the same ExternalBlob/blob-storage approach used for Story images, and update all Local Update query methods to return the new shape.
- Update generated Candid bindings so the frontend compiles against the updated backend interface.
- Add an optional image picker to the “Post Local Update” dialog with validation (image-only + size limit messaging), preview, and remove/clear before posting; submit the image using the same ArrayBuffer -> Uint8Array -> ExternalBlob conversion pattern as Story posting.
- Update Local Update UI surfaces to render the optional image when present (at minimum the Local Update detail dialog), while keeping layouts clean when no image exists.
- Update Local Update React Query hooks/mutations to accept/forward the optional image and match the updated addLocalUpdate signature/types (including BigInt radius handling where applicable).

**User-visible outcome:** Deployments succeed again, and users can optionally attach an image when posting a Local Update, preview/remove it before submitting, and see the image displayed on Local Updates where supported (including the detail view).
