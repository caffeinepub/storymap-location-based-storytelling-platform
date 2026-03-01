import Map "mo:core/Map";
import List "mo:core/List";
import Set "mo:core/Set";
import Storage "blob-storage/Storage";

module {
  type OldLocation = {
    latitude : Float;
    longitude : Float;
  };

  type OldStory = {
    id : Text;
    title : Text;
    content : Text;
    category : {
      #love;
      #confession;
      #funny;
      #random;
      #other;
    };
    locationName : ?Text;
    location : OldLocation;
    timestamp : Int;
    author : Principal;
    isAnonymous : Bool;
    likeCount : Nat;
    pinCount : Nat;
    image : ?Storage.ExternalBlob;
    viewCount : Nat;
  };

  type OldStoryWithViewers = {
    id : Text;
    title : Text;
    content : Text;
    category : {
      #love;
      #confession;
      #funny;
      #random;
      #other;
    };
    locationName : ?Text;
    location : OldLocation;
    timestamp : Int;
    author : Principal;
    isAnonymous : Bool;
    likeCount : Nat;
    pinCount : Nat;
    image : ?Storage.ExternalBlob;
    viewCount : Nat;
    viewers : Set.Set<Principal>;
  };

  type OldStoryDraft = {
    id : Text;
    title : Text;
    content : Text;
    category : {
      #love;
      #confession;
      #funny;
      #random;
      #other;
    };
    locationName : ?Text;
    location : ?OldLocation;
    timestamp : Int;
    author : Principal;
    isAnonymous : Bool;
    image : ?Storage.ExternalBlob;
    createdAt : Int;
    updatedAt : Int;
  };

  type NewStory = {
    id : Text;
    title : Text;
    content : Text;
    category : {
      #love;
      #confession;
      #funny;
      #random;
      #other;
    };
    locationName : ?Text;
    latitude : Float;
    longitude : Float;
    timestamp : Int;
    author : Principal;
    isAnonymous : Bool;
    likeCount : Nat;
    pinCount : Nat;
    image : ?Storage.ExternalBlob;
    viewCount : Nat;
  };

  type NewStoryWithViewers = {
    id : Text;
    title : Text;
    content : Text;
    category : {
      #love;
      #confession;
      #funny;
      #random;
      #other;
    };
    locationName : ?Text;
    latitude : Float;
    longitude : Float;
    timestamp : Int;
    author : Principal;
    isAnonymous : Bool;
    likeCount : Nat;
    pinCount : Nat;
    image : ?Storage.ExternalBlob;
    viewCount : Nat;
    viewers : Set.Set<Principal>;
  };

  type NewStoryDraft = {
    id : Text;
    title : Text;
    content : Text;
    category : {
      #love;
      #confession;
      #funny;
      #random;
      #other;
    };
    locationName : ?Text;
    latitude : ?Float;
    longitude : ?Float;
    timestamp : Int;
    author : Principal;
    isAnonymous : Bool;
    image : ?Storage.ExternalBlob;
    createdAt : Int;
    updatedAt : Int;
  };

  type OldActor = {
    stories : Map.Map<Text, OldStoryWithViewers>;
    drafts : Map.Map<Text, OldStoryDraft>;
  };

  type NewActor = {
    stories : Map.Map<Text, NewStoryWithViewers>;
    drafts : Map.Map<Text, NewStoryDraft>;
  };

  func migrateStory(oldStory : OldStory) : NewStory {
    {
      oldStory with
      latitude = oldStory.location.latitude;
      longitude = oldStory.location.longitude;
    };
  };

  func migrateStoryWithViewers(oldStory : OldStoryWithViewers) : NewStoryWithViewers {
    {
      oldStory with
      latitude = oldStory.location.latitude;
      longitude = oldStory.location.longitude;
    };
  };

  func migrateStoryDraft(oldDraft : OldStoryDraft) : NewStoryDraft {
    {
      oldDraft with
      latitude = switch (oldDraft.location) {
        case (null) { null };
        case (?location) { ?location.latitude };
      };
      longitude = switch (oldDraft.location) {
        case (null) { null };
        case (?location) { ?location.longitude };
      };
    };
  };

  public func run(old : OldActor) : NewActor {
    let newStories = old.stories.map<Text, OldStoryWithViewers, NewStoryWithViewers>(
      func(_id, story) { migrateStoryWithViewers(story) }
    );

    let newDrafts = old.drafts.map<Text, OldStoryDraft, NewStoryDraft>(
      func(_id, draft) { migrateStoryDraft(draft) }
    );

    {
      stories = newStories;
      drafts = newDrafts;
    };
  };
};
