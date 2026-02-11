import Map "mo:core/Map";
import Array "mo:core/Array";
import Text "mo:core/Text";
import Iter "mo:core/Iter";
import Principal "mo:core/Principal";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import Int "mo:core/Int";
import Float "mo:core/Float";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Set "mo:core/Set";
import Time "mo:core/Time";
import AccessControl "authorization/access-control";
import Storage "blob-storage/Storage";
import MixinAuthorization "authorization/MixinAuthorization";
import MixinStorage "blob-storage/Mixin";
import Migration "migration";

(with migration = Migration.run)
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
    locationName : ?Text;
    location : Location;
    timestamp : Int;
    author : Principal;
    isAnonymous : Bool;
    likeCount : Nat;
    pinCount : Nat;
    image : ?Storage.ExternalBlob;
    viewCount : Nat;
  };

  public type StoryView = {
    id : Text;
    title : Text;
    content : Text;
    category : Category;
    locationName : ?Text;
    location : Location;
    timestamp : Int;
    author : Principal;
    isAnonymous : Bool;
    likeCount : Nat;
    pinCount : Nat;
    image : ?Storage.ExternalBlob;
    viewCount : Nat;
    viewers : [Principal];
  };

  public type UserProfile = {
    id : Principal;
    username : Text;
    storiesPosted : Nat;
    likedStories : [Text];
    pinnedStories : [Text];
    seenIntro : Bool;
  };

  public type SortOption = {
    #newest;
    #nearest : { location : Location };
    #mostLiked;
    #mostViewed;
    #mostPinned;
  };

  public type SearchParams = {
    keywords : ?Text;
    category : ?Category;
    radius : ?Float;
    coordinates : Location;
    sort : SortOption;
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

  public type StoryId = Text;
  public type CommentId = Nat;

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

    public func compareByLocation(a : Story, b : Story, location : Location) : Order.Order {
      let distanceA = calculateDistance(a.location, location);
      let distanceB = calculateDistance(b.location, location);

      Float.compare(distanceA, distanceB);
    };

    func calculateDistance(loc1 : Location, loc2 : Location) : Float {
      let earthRadiusKm : Float = 6371.0;

      func degreesToRadians(degrees : Float) : Float {
        degrees * (Float.pi / 180.0);
      };

      func haversine(coord1 : Location, coord2 : Location) : Float {
        let lat1 = degreesToRadians(coord1.latitude);
        let lon1 = degreesToRadians(coord1.longitude);
        let lat2 = degreesToRadians(coord2.latitude);
        let lon2 = degreesToRadians(coord2.longitude);

        let dlat = lat2 - lat1;
        let dlon = lon2 - lon1;

        let a = Float.sin(dlat / 2.0) ** 2 +
                Float.cos(lat1) * Float.cos(lat2) *
                (Float.sin(dlon / 2.0) ** 2);
        let c = 2.0 * Float.arctan2(Float.sqrt(a), Float.sqrt(1.0 - a));
        earthRadiusKm * c;
      };

      haversine(loc1, loc2);
    };
  };

  public type StoryWithViewers = {
    id : Text;
    title : Text;
    content : Text;
    category : Category;
    locationName : ?Text;
    location : Location;
    timestamp : Int;
    author : Principal;
    isAnonymous : Bool;
    likeCount : Nat;
    pinCount : Nat;
    image : ?Storage.ExternalBlob;
    viewCount : Nat;
    viewers : Set.Set<Principal>;
  };

  public type StoryDraft = {
    id : Text;
    title : Text;
    content : Text;
    category : Category;
    locationName : ?Text;
    location : ?Location;
    timestamp : Int;
    author : Principal;
    isAnonymous : Bool;
    image : ?Storage.ExternalBlob;
    createdAt : Int;
    updatedAt : Int;
  };

  // Local Updates
  public type LocalCategory = {
    #traffic;
    #power;
    #police;
    #event;
    #nature;
    #general;
  };

  type LocalUpdate = {
    id : Nat;
    content : Text;
    latitude : Float;
    longitude : Float;
    radius : Nat;
    timestamp : Int;
    category : LocalCategory;
    author : Principal;
    image : ?Storage.ExternalBlob;
    thumbsUp : Nat;
  };

  // Public representation for UI/Frontend
  public type LocalUpdatePublic = {
    id : Nat;
    content : Text;
    latitude : Float;
    longitude : Float;
    radius : Nat;
    timestamp : Int;
    category : LocalCategory;
    author : Principal;
    image : ?Storage.ExternalBlob;
    thumbsUp : Nat;
  };

  var nextLocalUpdateId = 0;
  let localUpdates = Map.empty<Nat, LocalUpdate>();
  let thumbsUpList = Map.empty<Nat, Set.Set<Principal>>();
  var lastCleanupTimestamp : Time.Time = 0;

  let stories = Map.empty<StoryId, StoryWithViewers>();
  let userProfiles = Map.empty<Principal, UserProfile>();
  let userLikes = Map.empty<Principal, Set.Set<Text>>();
  let userPins = Map.empty<Principal, Set.Set<Text>>();
  let comments = Map.empty<Text, List.List<Comment>>();
  let reports = Map.empty<Nat, Report>();
  var nextCommentId : Nat = 0;
  var nextReportId : Nat = 0;
  var nextStoryId : Nat = 0;

  let drafts = Map.empty<Text, StoryDraft>();

  func toStoryViewArray(withViewers : [StoryWithViewers]) : [StoryView] {
    withViewers.map(func(story) { toStoryView(story) });
  };

  func toStoryView(story : StoryWithViewers) : StoryView {
    {
      id = story.id;
      title = story.title;
      content = story.content;
      category = story.category;
      locationName = story.locationName;
      location = story.location;
      timestamp = story.timestamp;
      author = story.author;
      isAnonymous = story.isAnonymous;
      likeCount = story.likeCount;
      pinCount = story.pinCount;
      image = story.image;
      viewCount = story.viewCount;
      viewers = story.viewers.toArray();
    };
  };

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

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

  public query ({ caller }) func hasSeenIntro() : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can check intro status");
    };
    switch (userProfiles.get(caller)) {
      case (null) { false };
      case (?profile) { profile.seenIntro };
    };
  };

  public query ({ caller }) func getStoryById(id : Text) : async Story {
    switch (stories.get(id)) {
      case (null) { Runtime.trap("Story does not exist") };
      case (?storyWithViewers) { storyWithViewers };
    };
  };

  public shared ({ caller }) func updateStory(
    storyId : Text,
    title : Text,
    content : Text,
    category : Category,
    locationName : ?Text,
    location : Location,
    isAnonymous : Bool,
    image : ?Storage.ExternalBlob,
  ) : async () {
    switch (stories.get(storyId)) {
      case (null) {
        Runtime.trap("Story does not exist");
      };
      case (?existingStory) {
        if (caller != existingStory.author and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Only the story author or admins can update stories");
        };

        let updatedStory : StoryWithViewers = {
          existingStory with
          title = title;
          content = content;
          category = category;
          locationName = locationName;
          location = location;
          isAnonymous = isAnonymous;
          image = image;
        };
        stories.add(storyId, updatedStory);
      };
    };
  };

  public shared ({ caller }) func incrementStoryViewCount(id : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can increment view count");
    };
    switch (stories.get(id)) {
      case (null) { Runtime.trap("Story does not exist") };
      case (?storyWithViewers) {
        if (not storyWithViewers.viewers.contains(caller)) {
          let updatedViewers = storyWithViewers.viewers.clone();
          updatedViewers.add(caller);

          let updatedStory : StoryWithViewers = {
            storyWithViewers with viewCount = storyWithViewers.viewCount + 1;
            viewers = updatedViewers;
          };
          stories.add(id, updatedStory);
        };
      };
    };
  };

  func matchesKeywords(story : StoryWithViewers, keywords : ?Text) : Bool {
    switch (keywords) {
      case (null) { true };
      case (?kwords) {
        let lowercaseKeywords = kwords.toLower();
        story.title.toLower().contains(#text lowercaseKeywords) or story.content.toLower().contains(#text lowercaseKeywords);
      };
    };
  };

  func matchesCategory(story : StoryWithViewers, category : ?Category) : Bool {
    switch (category) {
      case (null) { true };
      case (?cat) { story.category == cat };
    };
  };

  func isWithinRadius(story : StoryWithViewers, coordinates : Location, radius : ?Float) : Bool {
    let earthRadiusKm : Float = 6371.0;

    func degreesToRadians(degrees : Float) : Float {
      degrees * (Float.pi / 180.0);
    };

    func haversine(coord1 : Location, coord2 : Location) : Float {
      let lat1 = degreesToRadians(coord1.latitude);
      let lon1 = degreesToRadians(coord1.longitude);
      let lat2 = degreesToRadians(coord2.latitude);
      let lon2 = degreesToRadians(coord2.longitude);

      let dlat = lat2 - lat1;
      let dlon = lon2 - lon1;

      let a = Float.sin(dlat / 2.0) ** 2 +
              Float.cos(lat1) * Float.cos(lat2) *
              (Float.sin(dlon / 2.0) ** 2);
      let c = 2.0 * Float.arctan2(Float.sqrt(a), Float.sqrt(1.0 - a));
      earthRadiusKm * c;
    };

    switch (radius) {
      case (null) { true };
      case (?r) { haversine(story.location, coordinates) <= r };
    };
  };

  func getFilteredStories(
    stories : Map.Map<Text, StoryWithViewers>,
    matchesKeywords : (StoryWithViewers, ?Text) -> Bool,
    matchesCategory : (StoryWithViewers, ?Category) -> Bool,
    matchesRadius : (StoryWithViewers, Location, ?Float) -> Bool,
    params : SearchParams
  ) : Iter.Iter<StoryWithViewers> {
    stories.values().filter(func(story) { matchesKeywords(story, params.keywords) and matchesCategory(story, params.category) and matchesRadius(story, params.coordinates, params.radius) });
  };

  public query ({ caller }) func searchStories(params : SearchParams) : async [Story] {
    let filteredStories = getFilteredStories(
      stories,
      matchesKeywords,
      matchesCategory,
      isWithinRadius,
      params
    );

    sortStories(filteredStories.toArray(), params.sort).sliceToArray(0, 32);
  };

  func sortStories(stories : [StoryWithViewers], sortOption : SortOption) : [StoryWithViewers] {
    switch (sortOption) {
      case (#newest) {
        stories.sort(
          func(a, b) {
            Int.compare(b.timestamp, a.timestamp);
          }
        );
      };
      case (#nearest { location }) {
        stories.sort(
          func(a, b) {
            Story.compareByLocation(a, b, location);
          }
        );
      };
      case (#mostLiked) {
        stories.sort(
          func(a, b) {
            Nat.compare(b.likeCount, a.likeCount);
          }
        );
      };
      case (#mostViewed) {
        stories.sort(
          func(a, b) {
            Nat.compare(b.viewCount, a.viewCount);
          }
        );
      };
      case (#mostPinned) {
        stories.sort(
          func(a, b) {
            Nat.compare(b.pinCount, a.pinCount);
          }
        );
      };
    };
  };

  public query ({ caller }) func getStoriesByCategory(category : Category, sortOption : SortOption) : async [Story] {
    let categoryStories = stories.values().toArray().filter(
      func(storyWithViewers) { storyWithViewers.category == category }
    );
    sortStories(categoryStories, sortOption);
  };

  public query ({ caller }) func getComments(storyId : Text) : async [Comment] {
    switch (comments.get(storyId)) {
      case (null) { [] };
      case (?commentList) { commentList.toArray() };
    };
  };

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

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

  public shared ({ caller }) func createStory(
    title : Text,
    content : Text,
    category : Category,
    locationName : ?Text,
    location : Location,
    timestamp : Int,
    isAnonymous : Bool,
    image : ?Storage.ExternalBlob
  ) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create stories");
    };

    let storyId = generateStoryId();
    let story : StoryWithViewers = {
      id = storyId;
      title = title;
      content = content;
      category = category;
      locationName = locationName;
      location = location;
      timestamp = timestamp;
      author = caller;
      isAnonymous = isAnonymous;
      likeCount = 0;
      pinCount = 0;
      image = image;
      viewCount = 0;
      viewers = Set.empty<Principal>();
    };

    stories.add(storyId, story);

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

  public shared ({ caller }) func likeStory(storyId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can like stories");
    };

    switch (stories.get(storyId)) {
      case (null) { Runtime.trap("Story does not exist") };
      case (?storyWithViewers) {
        let userLikesSet = getUserLikesSet(caller);

        if (userLikesSet.contains(storyId)) {
          Runtime.trap("Story already liked");
        };

        userLikesSet.add(storyId);

        let updatedStory : StoryWithViewers = {
          storyWithViewers with likeCount = storyWithViewers.likeCount + 1;
        };
        stories.add(storyId, updatedStory);

        let updatedLikedStories = userLikesSet.toArray();

        switch (userProfiles.get(caller)) {
          case (null) {
            let newProfile : UserProfile = {
              id = caller;
              username = "";
              storiesPosted = 0;
              likedStories = updatedLikedStories;
              pinnedStories = [];
              seenIntro = false;
            };
            userProfiles.add(caller, newProfile);
          };
          case (?profile) {
            let updatedProfile : UserProfile = {
              id = profile.id;
              username = profile.username;
              storiesPosted = profile.storiesPosted;
              likedStories = updatedLikedStories;
              pinnedStories = profile.pinnedStories;
              seenIntro = profile.seenIntro;
            };
            userProfiles.add(caller, updatedProfile);
          };
        };
      };
    };
  };

  public shared ({ caller }) func unlikeStory(storyId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can unlike stories");
    };

    switch (stories.get(storyId)) {
      case (null) { Runtime.trap("Story does not exist") };
      case (?storyWithViewers) {
        let userLikesSet = getUserLikesSet(caller);

        if (not userLikesSet.contains(storyId)) {
          Runtime.trap("Story not liked");
        };

        userLikesSet.remove(storyId);

        let updatedStory : StoryWithViewers = {
          storyWithViewers with likeCount = if (storyWithViewers.likeCount > 0) { storyWithViewers.likeCount - 1 } else { 0 };
        };
        stories.add(storyId, updatedStory);

        let updatedLikedStories = userLikesSet.toArray();

        switch (userProfiles.get(caller)) {
          case (null) {
            let newProfile : UserProfile = {
              id = caller;
              username = "";
              storiesPosted = 0;
              likedStories = updatedLikedStories;
              pinnedStories = [];
              seenIntro = false;
            };
            userProfiles.add(caller, newProfile);
          };
          case (?profile) {
            let updatedProfile : UserProfile = {
              id = profile.id;
              username = profile.username;
              storiesPosted = profile.storiesPosted;
              likedStories = updatedLikedStories;
              pinnedStories = profile.pinnedStories;
              seenIntro = profile.seenIntro;
            };
            userProfiles.add(caller, updatedProfile);
          };
        };
      };
    };
  };

  public shared ({ caller }) func pinStory(storyId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can pin stories");
    };

    switch (stories.get(storyId)) {
      case (null) { Runtime.trap("Story does not exist") };
      case (?storyWithViewers) {
        let userPinsSet = getUserPinsSet(caller);

        if (userPinsSet.contains(storyId)) {
          Runtime.trap("Story already pinned");
        };

        userPinsSet.add(storyId);

        let updatedStory : StoryWithViewers = {
          storyWithViewers with pinCount = storyWithViewers.pinCount + 1;
        };
        stories.add(storyId, updatedStory);

        let updatedPinnedStories = userPinsSet.toArray();

        switch (userProfiles.get(caller)) {
          case (null) {
            let newProfile : UserProfile = {
              id = caller;
              username = "";
              storiesPosted = 0;
              likedStories = [];
              pinnedStories = updatedPinnedStories;
              seenIntro = false;
            };
            userProfiles.add(caller, newProfile);
          };
          case (?profile) {
            let updatedProfile : UserProfile = {
              id = profile.id;
              username = profile.username;
              storiesPosted = profile.storiesPosted;
              likedStories = profile.likedStories;
              pinnedStories = updatedPinnedStories;
              seenIntro = profile.seenIntro;
            };
            userProfiles.add(caller, updatedProfile);
          };
        };
      };
    };
  };

  public shared ({ caller }) func unpinStory(storyId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can unpin stories");
    };

    switch (stories.get(storyId)) {
      case (null) { Runtime.trap("Story does not exist") };
      case (?storyWithViewers) {
        let userPinsSet = getUserPinsSet(caller);

        if (not userPinsSet.contains(storyId)) {
          Runtime.trap("Story not pinned");
        };

        userPinsSet.remove(storyId);

        let updatedStory : StoryWithViewers = {
          storyWithViewers with pinCount = if (storyWithViewers.pinCount > 0) { storyWithViewers.pinCount - 1 } else { 0 };
        };
        stories.add(storyId, updatedStory);

        let updatedPinnedStories = userPinsSet.toArray();

        switch (userProfiles.get(caller)) {
          case (null) {
            let newProfile : UserProfile = {
              id = caller;
              username = "";
              storiesPosted = 0;
              likedStories = [];
              pinnedStories = updatedPinnedStories;
              seenIntro = false;
            };
            userProfiles.add(caller, newProfile);
          };
          case (?profile) {
            let updatedProfile : UserProfile = {
              id = profile.id;
              username = profile.username;
              storiesPosted = profile.storiesPosted;
              likedStories = profile.likedStories;
              pinnedStories = updatedPinnedStories;
              seenIntro = profile.seenIntro;
            };
            userProfiles.add(caller, updatedProfile);
          };
        };
      };
    };
  };

  public shared ({ caller }) func addComment(
    storyId : Text,
    content : Text,
    timestamp : Int,
    isAnonymous : Bool
  ) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can comment");
    };

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

  public shared ({ caller }) func reportStory(
    storyId : Text,
    reason : Text,
    timestamp : Int
  ) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can report stories");
    };

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

  public shared ({ caller }) func removeStory(id : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can remove stories");
    };

    switch (stories.get(id)) {
      case (null) { Runtime.trap("Story does not exist") };
      case (?storyWithViewers) {
        if (caller != storyWithViewers.author and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Only the story author or admins can remove stories");
        };

        stories.remove(id);

        comments.remove(id);
      };
    };
  };

  public query ({ caller }) func getReports() : async [Report] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view reports");
    };

    reports.values().toArray();
  };

  public shared ({ caller }) func removeReport(reportId : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can remove reports");
    };

    reports.remove(reportId);
  };

  public query ({ caller }) func getAllStories() : async [Story] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all stories");
    };

    stories.values().toArray();
  };

  func getStoriesByIds(ids : [Text]) : [StoryView] {
    ids.map(
      func(id) {
        stories.get(id);
      }
    ).filter(
      func(storyOpt) {
        switch (storyOpt) {
          case (null) { false };
          case (?_) { true };
        };
      }
    ).map(
      func(storyOpt) {
        switch (storyOpt) {
          case (null) { Runtime.trap("Should never happen, filtered out nulls") };
          case (?story) { toStoryView(story) };
        };
      }
    );
  };

  public query ({ caller }) func getStoriesByUser(author : Principal) : async [StoryView] {
    if (caller != author and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own posted stories");
    };

    let filtered = stories.values().toArray().filter(
      func(story) { story.author == author }
    );
    toStoryViewArray(filtered);
  };

  public query ({ caller }) func getLikedStoriesByUser(user : Principal) : async [StoryView] {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own liked stories");
    };

    switch (userProfiles.get(user)) {
      case (null) { [] };
      case (?profile) {
        getStoriesByIds(profile.likedStories);
      };
    };
  };

  public query ({ caller }) func getPinnedStoriesByUser(user : Principal) : async [StoryView] {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own pinned stories");
    };

    switch (userProfiles.get(user)) {
      case (null) { [] };
      case (?profile) {
        getStoriesByIds(profile.pinnedStories);
      };
    };
  };

  public shared ({ caller }) func createDraft(
    title : Text,
    content : Text,
    category : Category,
    locationName : ?Text,
    location : ?Location,
    isAnonymous : Bool,
    image : ?Storage.ExternalBlob,
  ) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create drafts");
    };

    let draftId = "draft_" # drafts.size().toText();

    let draft : StoryDraft = {
      id = draftId;
      title = title;
      content = content;
      category = category;
      locationName = locationName;
      location = location;
      timestamp = Time.now();
      author = caller;
      isAnonymous = isAnonymous;
      image = image;
      createdAt = Time.now();
      updatedAt = Time.now();
    };

    drafts.add(draftId, draft);
    draftId;
  };

  public shared ({ caller }) func updateDraft(
    draftId : Text,
    title : Text,
    content : Text,
    category : Category,
    locationName : ?Text,
    location : ?Location,
    isAnonymous : Bool,
    image : ?Storage.ExternalBlob,
  ) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update drafts");
    };

    switch (drafts.get(draftId)) {
      case (null) { Runtime.trap("Draft does not exist") };
      case (?existingDraft) {
        if (existingDraft.author != caller) {
          Runtime.trap("Unauthorized: Only the draft author can update the draft");
        };

        let updatedDraft : StoryDraft = {
          existingDraft with
          title = title;
          content = content;
          category = category;
          locationName = locationName;
          location = location;
          isAnonymous = isAnonymous;
          image = image;
          updatedAt = Time.now();
        };
        drafts.add(draftId, updatedDraft);
      };
    };
  };

  public shared ({ caller }) func deleteDraft(draftId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete drafts");
    };

    switch (drafts.get(draftId)) {
      case (null) { Runtime.trap("Draft does not exist") };
      case (?draft) {
        if (draft.author != caller) {
          Runtime.trap("Unauthorized: Only the draft author can delete their draft");
        };
        drafts.remove(draftId);
      };
    };
  };

  public shared ({ caller }) func publishDraft(draftId : Text) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can publish drafts");
    };

    switch (drafts.get(draftId)) {
      case (null) { Runtime.trap("Draft does not exist") };
      case (?draft) {
        if (draft.author != caller) {
          Runtime.trap("Unauthorized: Only the draft author can publish the draft");
        };

        let storyId = generateStoryId();

        let finalLocation : Location = switch (draft.location) {
          case (null) { Runtime.trap("Published stories must have a location") };
          case (?loc) { loc };
        };

        let story : StoryWithViewers = {
          id = storyId;
          title = draft.title;
          content = draft.content;
          category = draft.category;
          locationName = draft.locationName;
          location = finalLocation;
          timestamp = Time.now();
          author = draft.author;
          isAnonymous = draft.isAnonymous;
          likeCount = 0;
          pinCount = 0;
          image = draft.image;
          viewCount = 0;
          viewers = Set.empty<Principal>();
        };

        stories.add(storyId, story);

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

        drafts.remove(draftId);
        storyId;
      };
    };
  };

  public query ({ caller }) func getDraft(draftId : Text) : async ?StoryDraft {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access drafts");
    };

    switch (drafts.get(draftId)) {
      case (null) { null };
      case (?draft) {
        if (draft.author != caller) {
          Runtime.trap("Unauthorized: Only the draft author can fetch their draft");
        };
        ?draft;
      };
    };
  };

  public query ({ caller }) func listDrafts() : async [StoryDraft] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can list their drafts");
    };

    let userDrafts : Iter.Iter<StoryDraft> = drafts.values().filter(
      func(draft) { draft.author == caller }
    );
    userDrafts.toArray();
  };

  ///////////////////////////////////
  // Local Updates Functionality
  ///////////////////////////////////

  public shared ({ caller }) func addLocalUpdate(
    content : Text,
    latitude : Float,
    longitude : Float,
    radius : Nat,
    category : LocalCategory,
    image : ?Storage.ExternalBlob // Accept image as part of local update
  ) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can add local updates");
    };

    if (radius < 200 or radius > 1000) {
      Runtime.trap("Invalid radius: Must be between 200-1000 meters");
    };

    let updateId = nextLocalUpdateId;
    nextLocalUpdateId += 1;

    let update : LocalUpdate = {
      id = updateId;
      content;
      latitude;
      longitude;
      radius;
      timestamp = Time.now();
      category;
      author = caller;
      image; // Store image in local update
      thumbsUp = 0; // Init thumbs up for new stories
    };

    localUpdates.add(updateId, update);
    updateId;
  };

  public shared ({ caller }) func removeLocalUpdate(id : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can remove local updates");
    };

    switch (localUpdates.get(id)) {
      case (null) { Runtime.trap("Local update does not exist") };
      case (?update) {
        if (caller != update.author and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Only the update author or admins can remove local updates");
        };
        localUpdates.remove(id);
      };
    };
  };

  // Make one-way transform to immutable public representation for local updates
  func localUpdateToPublic(update : LocalUpdate) : LocalUpdatePublic {
    {
      id = update.id;
      content = update.content;
      latitude = update.latitude;
      longitude = update.longitude;
      radius = update.radius;
      timestamp = update.timestamp;
      category = update.category;
      author = update.author;
      image = update.image;
      thumbsUp = update.thumbsUp;
    };
  };

  public query ({ caller }) func getLocalUpdateById(id : Nat) : async LocalUpdatePublic {
    switch (localUpdates.get(id)) {
      case (null) { Runtime.trap("Local update does not exist") };
      case (?update) { localUpdateToPublic(update) };
    };
  };

  public type ProximityQuery = {
    latitude : Float;
    longitude : Float;
  };

  public query ({ caller }) func queryByProximity(proximityQuery : ProximityQuery) : async [LocalUpdatePublic] {
    let activeAndNearbyUpdates : Iter.Iter<LocalUpdate> = localUpdates.filter(
      func(_id, update) {
        isLocalUpdateActive(update) and isWithinLocalRadius(update, proximityQuery.latitude, proximityQuery.longitude);
      }
    ).values();

    // Convert each entry from LocalUpdate to LocalUpdatePublic
    activeAndNearbyUpdates.map<LocalUpdate, LocalUpdatePublic>(
      func(update) {
        localUpdateToPublic(update);
      }
    ).toArray();
  };

  public query ({ caller }) func getLocalUpdatesByCategory(category : LocalCategory) : async [LocalUpdatePublic] {
    let activeUpdatesByCategory : Iter.Iter<LocalUpdate> = localUpdates.filter(
      func(_id, update) {
        update.category == category and isLocalUpdateActive(update);
      }
    ).values();

    // Convert each entry from LocalUpdate to LocalUpdatePublic
    activeUpdatesByCategory.map<LocalUpdate, LocalUpdatePublic>(
      func(update) {
        localUpdateToPublic(update);
      }
    ).toArray();
  };

  public query ({ caller }) func getAllActiveLocalUpdates() : async [LocalUpdatePublic] {
    let allActiveUpdates : Iter.Iter<LocalUpdate> = localUpdates.filter(
      func(_id, update) {
        isLocalUpdateActive(update);
      }
    ).values();

    // Convert each entry from LocalUpdate to LocalUpdatePublic
    allActiveUpdates.map<LocalUpdate, LocalUpdatePublic>(
      func(update) {
        localUpdateToPublic(update);
      }
    ).toArray();
  };

  public query ({ caller }) func getActiveLocalUpdatesByProximity(location : Location) : async [LocalUpdatePublic] {
    let activeUpdatesIter = localUpdates.values().filter(
      func(update) {
        isLocalUpdateActive(update) and isWithinLocalRadius(update, location.latitude, location.longitude)
      }
    );

    // Convert each entry from LocalUpdate to LocalUpdatePublic
    let publicUpdatesIter = activeUpdatesIter.map(
      func(update) {
        localUpdateToPublic(update);
      }
    );

    Array.fromIter(publicUpdatesIter);
  };

  func calculateDistance(lat1 : Float, lon1 : Float, lat2 : Float, lon2 : Float) : Float {
    let earthRadiusKm : Float = 6371.0;

    func degreesToRadians(degrees : Float) : Float {
      degrees * (Float.pi / 180.0);
    };

    func haversine(lat1 : Float, lon1 : Float, lat2 : Float, lon2 : Float) : Float {
      let lat1Rad = degreesToRadians(lat1);
      let lon1Rad = degreesToRadians(lon1);
      let lat2Rad = degreesToRadians(lat2);
      let lon2Rad = degreesToRadians(lon2);

      let dLat = lat2Rad - lat1Rad;
      let dLon = lon2Rad - lon1Rad;

      let a = Float.sin(dLat / 2.0) ** 2 +
              Float.cos(lat1Rad) * Float.cos(lat2Rad) *
              (Float.sin(dLon / 2.0) ** 2);
      let c = 2.0 * Float.arctan2(Float.sqrt(a), Float.sqrt(1.0 - a));
      earthRadiusKm * c * 1000.0;
    };

    haversine(lat1, lon1, lat2, lon2);
  };

  func isWithinLocalRadius(update : LocalUpdate, userLat : Float, userLon : Float) : Bool {
    let distance = calculateDistance(userLat, userLon, update.latitude, update.longitude);
    distance <= update.radius.toFloat();
  };

  func isLocalUpdateActive(update : LocalUpdate) : Bool {
    let currentTime = Time.now();
    let age = currentTime - update.timestamp;
    let hours24 = 24 * 60 * 60 * 1000000000; // 24 hours in nanoseconds
    let hours12 = 12 * 60 * 60 * 1000000000;
    let days3 = 3 * 24 * 60 * 60 * 1000000000;
    let days7 = 7 * 24 * 60 * 60 * 1000000000;

    switch (update.category) {
      case (#traffic) {
        age <= hours12; // Traffic updates last up to 12 hours
      };
      case (#power) {
        age <= days7; // Power updates last up to 7 days
      };
      case (#police) {
        age <= hours12;
      };
      case (#event) {
        age <= days3; // Event updates last up to 3 days
      };
      case (#nature) { age <= hours24 }; // Nature updates last 24 hours
      case (#general) { age <= hours24 }; // General updates last 24 hours
    };
  };

  public shared ({ caller }) func thumbsUpLocalUpdate(updateId : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can give a thumbs-up");
    };

    switch (localUpdates.get(updateId)) {
      case (null) { Runtime.trap("Local update does not exist") };
      case (?update) {
        let existingSet = switch (thumbsUpList.get(updateId)) {
          case (null) {
            let newSet = Set.empty<Principal>();
            thumbsUpList.add(updateId, newSet);
            newSet;
          };
          case (?set) { set };
        };

        if (existingSet.contains(caller)) {
          Runtime.trap("You have already given a thumbs-up for this update");
        };

        existingSet.add(caller);

        let updatedUpdate = {
          update with thumbsUp = update.thumbsUp + 1
        };
        localUpdates.add(updateId, updatedUpdate);
      };
    };
  };
};
