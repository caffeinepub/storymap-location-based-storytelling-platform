import Map "mo:core/Map";
import Set "mo:core/Set";
import Array "mo:core/Array";
import Text "mo:core/Text";
import Iter "mo:core/Iter";
import Principal "mo:core/Principal";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import Int "mo:core/Int";
import Float "mo:core/Float";
import List "mo:core/List";

import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";
import Storage "blob-storage/Storage";
import MixinStorage "blob-storage/Mixin";

actor {
  include MixinStorage();

  public type Location = {
    latitude : Float;
    longitude : Float;
  };

  public type Category = {
    #love;
    #confession;
    #funny;
    #random;
    #other;
  };

  public type Story = {
    id : Text;
    title : Text;
    content : Text;
    category : Category;
    location : Location;
    timestamp : Int;
    author : Principal;
    isAnonymous : Bool;
    likeCount : Nat;
    pinCount : Nat;
    image : ?Storage.ExternalBlob;
  };

  public type UserProfile = {
    id : Principal;
    username : Text;
    storiesPosted : Nat;
    likedStories : [Text];
    pinnedStories : [Text];
    seenIntro : Bool;
  };

  public type SearchParams = {
    keywords : ?Text;
    category : ?Category;
    radius : ?Float;
    coordinates : Location;
  };

  public type Comment = {
    id : Nat;
    storyId : Text;
    author : Principal;
    content : Text;
    timestamp : Int;
    isAnonymous : Bool;
  };

  public type Report = {
    id : Nat;
    storyId : Text;
    reporter : Principal;
    reason : Text;
    timestamp : Int;
  };

  module Story {
    public func compare(a : Story, b : Story) : Order.Order {
      switch (Int.compare(b.pinCount, a.pinCount)) {
        case (#equal) { Int.compare(b.timestamp, a.timestamp) };
        case (order) { order };
      };
    };

    public func compareByTime(a : Story, b : Story) : Order.Order {
      Int.compare(b.timestamp, a.timestamp);
    };
  };

  public type StoryId = Text;
  public type CommentId = Nat;

  // Persistent storage
  let stories = Map.empty<StoryId, Story>();
  let userProfiles = Map.empty<Principal, UserProfile>();
  let userLikes = Map.empty<Principal, Set.Set<Text>>();
  let userPins = Map.empty<Principal, Set.Set<Text>>();
  let comments = Map.empty<Text, List.List<Comment>>();
  let reports = Map.empty<Nat, Report>();
  var nextCommentId : Nat = 0;
  var nextReportId : Nat = 0;
  var nextStoryId : Nat = 0;

  // Authorization module
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // Helper Functions
  func isWithinCategory(story : Story, category : ?Category) : Bool {
    switch (category) {
      case (null) { true };
      case (?c) { story.category == c };
    };
  };

  func generateStoryId() : Text {
    let id = nextStoryId;
    nextStoryId += 1;
    "story_" # id.toText();
  };

  func getUserLikesSet(user : Principal) : Set.Set<Text> {
    switch (userLikes.get(user)) {
      case (null) {
        let newSet = Set.empty<Text>();
        userLikes.add(user, newSet);
        newSet;
      };
      case (?set) { set };
    };
  };

  func getUserPinsSet(user : Principal) : Set.Set<Text> {
    switch (userPins.get(user)) {
      case (null) {
        let newSet = Set.empty<Text>();
        userPins.add(user, newSet);
        newSet;
      };
      case (?set) { set };
    };
  };

  // Helper function to check if user has seen intro - accessible to all including guests
  public query ({ caller }) func hasSeenIntro() : async Bool {
    switch (userProfiles.get(caller)) {
      case (null) { false };
      case (?profile) { profile.seenIntro };
    };
  };

  // Public query functions - accessible to all users including guests
  public query ({ caller }) func getStoryById(id : Text) : async Story {
    // No authorization check - public read access
    switch (stories.get(id)) {
      case (null) { Runtime.trap("Story does not exist") };
      case (?story) { story };
    };
  };

  public query ({ caller }) func getRecentStories(amount : Nat) : async [Story] {
    // No authorization check - public read access
    stories.values().toArray().sort(Story.compareByTime).sliceToArray(0, amount);
  };

  public query ({ caller }) func searchStories(params : SearchParams) : async [Story] {
    // No authorization check - public read access
    stories.values().toArray().sort().sliceToArray(0, 32);
  };

  public query ({ caller }) func getStoriesByCategory(category : Category) : async [Story] {
    // No authorization check - public read access
    stories.values().toArray().filter(
      func(story) { story.category == category }
    ).sort();
  };

  public query ({ caller }) func getComments(storyId : Text) : async [Comment] {
    // No authorization check - public read access
    switch (comments.get(storyId)) {
      case (null) { [] };
      case (?commentList) { commentList.toArray() };
    };
  };

  // User profile management - required by frontend
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    // Users can view their own profile, admins can view any profile
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  // Mark user as having seen intro - requires user authentication
  public shared ({ caller }) func markIntroSeen() : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can mark intro as seen");
    };

    switch (userProfiles.get(caller)) {
      case (null) {
        let newProfile : UserProfile = {
          id = caller;
          username = "";
          storiesPosted = 1;
          likedStories = [];
          pinnedStories = [];
          seenIntro = true;
        };
        userProfiles.add(caller, newProfile);
      };
      case (?profile) {
        let updatedProfile : UserProfile = {
          id = profile.id;
          username = profile.username;
          storiesPosted = profile.storiesPosted;
          likedStories = profile.likedStories;
          pinnedStories = profile.pinnedStories;
          seenIntro = true;
        };
        userProfiles.add(caller, updatedProfile);
      };
    };
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Story creation - requires user authentication
  public shared ({ caller }) func createStory(
    title : Text,
    content : Text,
    category : Category,
    location : Location,
    timestamp : Int,
    isAnonymous : Bool,
    image : ?Storage.ExternalBlob
  ) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create stories");
    };

    let storyId = generateStoryId();
    let story : Story = {
      id = storyId;
      title = title;
      content = content;
      category = category;
      location = location;
      timestamp = timestamp;
      author = caller;
      isAnonymous = isAnonymous;
      likeCount = 0;
      pinCount = 0;
      image = image;
    };

    stories.add(storyId, story);

    // Update user profile
    switch (userProfiles.get(caller)) {
      case (null) {
        let newProfile : UserProfile = {
          id = caller;
          username = "";
          storiesPosted = 1;
          likedStories = [];
          pinnedStories = [];
          seenIntro = false;
        };
        userProfiles.add(caller, newProfile);
      };
      case (?profile) {
        let updatedProfile : UserProfile = {
          id = profile.id;
          username = profile.username;
          storiesPosted = profile.storiesPosted + 1;
          likedStories = profile.likedStories;
          pinnedStories = profile.pinnedStories;
          seenIntro = profile.seenIntro;
        };
        userProfiles.add(caller, updatedProfile);
      };
    };

    storyId;
  };

  // Like story - requires user authentication
  public shared ({ caller }) func likeStory(storyId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can like stories");
    };

    switch (stories.get(storyId)) {
      case (null) { Runtime.trap("Story does not exist") };
      case (?story) {
        let userLikesSet = getUserLikesSet(caller);

        // Check if already liked
        if (userLikesSet.contains(storyId)) {
          Runtime.trap("Story already liked");
        };

        // Add like
        userLikesSet.add(storyId);

        // Update story like count
        let updatedStory : Story = {
          id = story.id;
          title = story.title;
          content = story.content;
          category = story.category;
          location = story.location;
          timestamp = story.timestamp;
          author = story.author;
          isAnonymous = story.isAnonymous;
          likeCount = story.likeCount + 1;
          pinCount = story.pinCount;
          image = story.image;
        };
        stories.add(storyId, updatedStory);
      };
    };
  };

  // Unlike story - requires user authentication
  public shared ({ caller }) func unlikeStory(storyId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can unlike stories");
    };

    switch (stories.get(storyId)) {
      case (null) { Runtime.trap("Story does not exist") };
      case (?story) {
        let userLikesSet = getUserLikesSet(caller);

        // Check if liked
        if (not userLikesSet.contains(storyId)) {
          Runtime.trap("Story not liked");
        };

        // Remove like
        userLikesSet.remove(storyId);

        // Update story like count
        let updatedStory : Story = {
          id = story.id;
          title = story.title;
          content = story.content;
          category = story.category;
          location = story.location;
          timestamp = story.timestamp;
          author = story.author;
          isAnonymous = story.isAnonymous;
          likeCount = if (story.likeCount > 0) { story.likeCount - 1 } else { 0 };
          pinCount = story.pinCount;
          image = story.image;
        };
        stories.add(storyId, updatedStory);
      };
    };
  };

  // Pin story - requires user authentication
  public shared ({ caller }) func pinStory(storyId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can pin stories");
    };

    switch (stories.get(storyId)) {
      case (null) { Runtime.trap("Story does not exist") };
      case (?story) {
        let userPinsSet = getUserPinsSet(caller);

        // Check if already pinned (one pin per user per story)
        if (userPinsSet.contains(storyId)) {
          Runtime.trap("Story already pinned");
        };

        // Add pin
        userPinsSet.add(storyId);

        // Update story pin count
        let updatedStory : Story = {
          id = story.id;
          title = story.title;
          content = story.content;
          category = story.category;
          location = story.location;
          timestamp = story.timestamp;
          author = story.author;
          isAnonymous = story.isAnonymous;
          likeCount = story.likeCount;
          pinCount = story.pinCount + 1;
          image = story.image;
        };
        stories.add(storyId, updatedStory);
      };
    };
  };

  // Unpin story - requires user authentication
  public shared ({ caller }) func unpinStory(storyId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can unpin stories");
    };

    switch (stories.get(storyId)) {
      case (null) { Runtime.trap("Story does not exist") };
      case (?story) {
        let userPinsSet = getUserPinsSet(caller);

        // Check if pinned
        if (not userPinsSet.contains(storyId)) {
          Runtime.trap("Story not pinned");
        };

        // Remove pin
        userPinsSet.remove(storyId);

        // Update story pin count
        let updatedStory : Story = {
          id = story.id;
          title = story.title;
          content = story.content;
          category = story.category;
          location = story.location;
          timestamp = story.timestamp;
          author = story.author;
          isAnonymous = story.isAnonymous;
          likeCount = story.likeCount;
          pinCount = if (story.pinCount > 0) { story.pinCount - 1 } else { 0 };
          image = story.image;
        };
        stories.add(storyId, updatedStory);
      };
    };
  };

  // Add comment - requires user authentication
  public shared ({ caller }) func addComment(
    storyId : Text,
    content : Text,
    timestamp : Int,
    isAnonymous : Bool
  ) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can comment");
    };

    // Verify story exists
    switch (stories.get(storyId)) {
      case (null) { Runtime.trap("Story does not exist") };
      case (?_) {
        let commentId = nextCommentId;
        nextCommentId += 1;

        let comment : Comment = {
          id = commentId;
          storyId = storyId;
          author = caller;
          content = content;
          timestamp = timestamp;
          isAnonymous = isAnonymous;
        };

        let existingComments = switch (comments.get(storyId)) {
          case (null) { List.empty<Comment>() };
          case (?list) { list };
        };

        existingComments.put(0, comment);
        comments.add(storyId, existingComments);
        commentId;
      };
    };
  };

  // Report story - requires user authentication
  public shared ({ caller }) func reportStory(
    storyId : Text,
    reason : Text,
    timestamp : Int
  ) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can report stories");
    };

    // Verify story exists
    switch (stories.get(storyId)) {
      case (null) { Runtime.trap("Story does not exist") };
      case (?_) {
        let reportId = nextReportId;
        nextReportId += 1;

        let report : Report = {
          id = reportId;
          storyId = storyId;
          reporter = caller;
          reason = reason;
          timestamp = timestamp;
        };

        reports.add(reportId, report);
        reportId;
      };
    };
  };

  // Remove story - requires ownership or admin privileges
  public shared ({ caller }) func removeStory(id : Text) : async () {
    switch (stories.get(id)) {
      case (null) { Runtime.trap("Story does not exist") };
      case (?story) {
        // Check if caller is the author or an admin
        if (caller != story.author and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Only the story author or admins can remove stories");
        };

        stories.remove(id);

        // Clean up associated comments
        comments.remove(id);
      };
    };
  };

  // Admin-only: Get all reports
  public query ({ caller }) func getReports() : async [Report] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view reports");
    };

    reports.values().toArray();
  };

  // Admin-only: Remove report
  public shared ({ caller }) func removeReport(reportId : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can remove reports");
    };

    reports.remove(reportId);
  };

  // Admin-only: Get all stories (for moderation)
  public query ({ caller }) func getAllStories() : async [Story] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all stories");
    };

    stories.values().toArray();
  };
};
