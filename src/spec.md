# StoryMap   Location Based Storytelling Platform

## Overview
StoryMap is a location-based storytelling platform where users can discover and share stories pinned to real-world locations. Users can explore nearby stories, contribute their own content, and interact with the community through likes, pins, and comments.

## Core Features

### Home Feed
- Auto-detect user location using browser geolocation API
- Display nearby stories in a scrollable list format
- Story cards show: title, story preview, category, like count, pin count, distance from user, and attached image (if present)
- **Story cards include fully functional Like, Comment, Pin, and Share buttons with real-time count updates**
- Sort stories by pin count (descending), with newest timestamp as tiebreaker
- Responsive design with dark/light mode toggle
- Floating "Add Story" button positioned at bottom-right corner, visible on both feed and map views
- For first-time users with no posted stories, automatically open story creation dialog on initial visit
- Story cards are clickable and open the full story detail dialog with smooth transitions
- Real-time updates to story cards when interactions occur in detail view

### Interactive Map View
- **Fully accurate interactive map using robust mapping library (Leaflet or Mapbox) with precise story location rendering**
- **Display user's current position with accurate geolocation detection**
- **Dynamic marker clustering based on proximity and zoom level for optimal performance**
- **Real-time story pin rendering that updates based on map viewport and zoom level**
- **Story previews on marker click displaying title, category, and distance from user**
- **Clickable marker previews with option to open full story details**
- Toggle between feed view and map view
- **Smooth coordination with search filters and feed for consistent map-to-feed synchronization**
- **Geolocation detection with fallback options and manual pin placement for users without location permission**
- Integration with map service for rendering
- Floating "Add Story" button remains visible and accessible

### Search and Filtering
- Search stories by keywords or specific locations
- Filter by category options: Love, Confession, Funny, and other predefined categories
- Filter by distance radius from user location
- **Real-time filtering updates synchronized between map and feed views**

### Story Creation
- Floating "+" button for creating new stories, accessible from all main views
- Proper location permission handling using `navigator.geolocation.getCurrentPosition()` with success and error callbacks
- Clear "Allow Location Access" button that triggers browser permission prompt
- Clear UI feedback during location request process
- If permission is denied or unavailable, provide manual location selection via small interactive map or latitude/longitude input fields
- Retry button that properly re-triggers `getCurrentPosition()` instead of showing persistent error
- Story form includes: title, story text, category selection, location pinning, and optional image upload
- Single image attachment per story using secure blob storage
- Option to post anonymously or with user identity
- Manual location selection on map or use current location
- Stories automatically tagged with coordinates, timestamp, user metadata, and image reference
- Auto-open creation dialog for users who haven't posted any stories yet
- **Robust authentication state verification that waits for Internet Identity session to fully initialize before showing "Please log in" messages**
- **Proper actor initialization sequence that ensures backend connectivity is established before allowing story posting**
- **Authentication check that only displays login prompts when user is genuinely unauthenticated, not during session initialization**
- **Loading states during authentication and actor initialization to prevent premature error messages**
- **Seamless story creation flow that works immediately after successful login without requiring page refresh**

### Story Detail View
- **Full story detail dialog with proper vertical scrolling that displays complete story text without cutoff**
- **Modal with dynamic height adjustment and smooth scrolling behavior for long content**
- **Fully functional Like button that toggles state, calls backend likeStory/unlikeStory, and updates counts in real-time with optimistic UI updates**
- **Fully functional Pin button that toggles state, calls backend pinStory/unpinStory, and updates counts in real-time with optimistic UI updates**
- **Fully functional Comment button that opens inline comment input modal with submission via addComment API**
- **Comments section that loads existing comments via getComments and displays new comments immediately**
- **Share button that uses browser's navigator.share API for supported devices with copy link fallback for unsupported browsers**
- **Delete Story button that appears only for the story author (and admins) within the StoryDetailDialog, positioned alongside other interaction buttons**
- **Delete button uses the delete-story-icon.dim_32x32.png icon and shows confirmation modal with "Are you sure you want to delete this story?" message**
- **On deletion confirmation, call backend removeStory function, close the dialog, refresh story feed, and show success/error toast messages**
- **All interaction buttons show proper loading states, error handling, and authentication awareness**
- **Authentication state verification before enabling any interaction buttons**
- **Real-time UI updates for all interactions with immediate count changes and state toggles**
- Display attached images in full detail view
- **Smooth transitions and accessibility support across all devices**

### Story Interactions
- **Like stories with full toggle functionality including proper authentication checks, optimistic UI updates, and real-time count display**
- **Pin stories with full toggle functionality including proper authentication checks, optimistic UI updates, and real-time count display**
- **Comment system with complete backend integration, comment input modal, real-time display, and immediate rendering of new comments**
- **Share functionality using navigator.share API with fallback to copy link for unsupported browsers**
- **Delete stories with author verification, confirmation modal, backend removeStory integration, and proper success/error feedback via toast messages**
- **All interactions properly connected to backend functions with optimistic updates and error handling**
- **Comprehensive loading and error states for all interaction buttons**
- **Authentication-aware interaction handling that only shows login prompts for genuinely unauthenticated users**
- Dynamic ranking updates based on pin activity per location
- **Real-time synchronization between story detail view and feed view**

### User Management
- Internet Identity authentication integration
- **Proper authentication state management with full session initialization before enabling user actions**
- **Actor initialization that waits for Internet Identity authentication before running story-related actions**
- Anonymous posting capability
- User profiles displaying:
  - Stories posted by user
  - Stories liked by user
  - Stories pinned by user
- Track user's story posting history to determine first-time user status

### Content Moderation
- Report functionality for inappropriate content
- Community guidelines display before first story post
- Content flagging system

## Backend Data Storage
The backend stores:
- Stories with title, content, category, coordinates (latitude/longitude), timestamp, author information, interaction counts, and image blob references
- User interactions including likes, pins, and comments with user association
- User profiles and authentication data
- User story posting history and counts
- Reported content and moderation flags
- Location-based indexing for efficient geographic queries
- Image blob storage integration for secure image upload and retrieval
- **Individual user interaction states for likes and pins per story**

## Backend Operations
- Create, read, update stories with geographic coordinates and image attachments
- **Delete stories via removeStory function with proper author and admin access control**
- Handle user authentication via Internet Identity
- **Process story interactions with toggle functionality:**
  - **likeStory/unlikeStory operations with user state tracking**
  - **pinStory/unpinStory operations with user state tracking**
  - **addComment operation for adding new comments**
  - **getComments operation for retrieving story comments**
- **Track individual user interaction states (liked/pinned status per story)**
- Geographic search and filtering of stories
- Content moderation and reporting system
- User profile management
- Track and retrieve user's story posting count for first-time user detection
- Secure image upload and retrieval using blob storage component
- Image metadata management and association with stories

## Technical Requirements
- Responsive web design with Tailwind CSS
- **Fully accurate interactive map integration using robust mapping library (Leaflet or Mapbox)**
- **Precise story location rendering with dynamic marker clustering based on proximity and zoom level**
- **Real-time story pin rendering that updates based on map viewport and zoom level**
- **User position display with accurate geolocation detection**
- **Story previews on marker click with title, category, and distance information**
- **Smooth map-to-feed synchronization with consistent filtering and search coordination**
- Proper browser geolocation API integration with `navigator.geolocation.getCurrentPosition()` and comprehensive error handling
- Clear UI feedback for location permission requests with "Allow Location Access" button
- Graceful fallback to manual location selection (interactive map or coordinate input) when permission is denied
- Retry functionality that properly re-triggers geolocation request
- **Complete Internet Identity authentication flow with proper session initialization and state management**
- **Actor initialization that waits for Internet Identity authentication before running story-related actions (create, like, comment, pin, delete)**
- **Optimistic UI updates for Like and Pin buttons with immediate visual feedback and error rollback**
- **Comment input modal with proper form handling and submission via addComment API**
- **Share functionality using navigator.share API with copy link fallback for unsupported browsers**
- **Delete confirmation modal with proper form handling, removeStory backend integration, and toast message feedback for success/error states**
- **Fully functional story interaction buttons (Like, Comment, Pin, Share, Delete) in both StoryCard and StoryDetailDialog components**
- **Authentication state verification that waits for session initialization before showing login prompts**
- **Comprehensive loading states and error handling for all user interactions**
- **Real-time UI updates for story counts, comments, and interaction states**
- **Proper modal scrolling behavior for story detail dialogs with full content display**
- Location-based data queries and indexing
- Persistent floating action button across different views
- First-time user detection and guided onboarding
- Blob storage integration for secure image handling
- Image display in story cards and detail views
- **Accessibility support for story interactions across all devices**
- Application content in English language
