import Map "mo:core/Map";
import Set "mo:core/Set";
import Principal "mo:core/Principal";
import Storage "blob-storage/Storage";

module {
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
    location : {
      latitude : Float;
      longitude : Float;
    };
    timestamp : Int;
    author : Principal;
    isAnonymous : Bool;
    likeCount : Nat;
    pinCount : Nat;
    image : ?Storage.ExternalBlob;
    viewCount : Nat;
    viewers : Set.Set<Principal>;
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
    location : {
      latitude : Float;
      longitude : Float;
    };
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
    location : ?{
      latitude : Float;
      longitude : Float;
    };
    timestamp : Int;
    author : Principal;
    isAnonymous : Bool;
    image : ?Storage.ExternalBlob;
    createdAt : Int;
    updatedAt : Int;
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
    location : ?{
      latitude : Float;
      longitude : Float;
    };
    timestamp : Int;
    author : Principal;
    isAnonymous : Bool;
    image : ?Storage.ExternalBlob;
    createdAt : Int;
    updatedAt : Int;
  };

  type OldActor = {
    stories : Map.Map<Text, OldStory>;
    drafts : Map.Map<Text, OldStoryDraft>;
    // ... other fields remain unchanged
  };

  type NewActor = {
    stories : Map.Map<Text, NewStory>;
    drafts : Map.Map<Text, NewStoryDraft>;
    // ... other fields remain unchanged
  };

  public func run(old : OldActor) : NewActor {
    let newStories = old.stories.map<Text, OldStory, NewStory>(
      func(_id, oldStory) {
        {
          oldStory with locationName = null
        };
      }
    );
    let newDrafts = old.drafts.map<Text, OldStoryDraft, NewStoryDraft>(
      func(_id, oldDraft) {
        {
          oldDraft with locationName = null
        };
      }
    );
    {
      old with
      stories = newStories;
      drafts = newDrafts;
    };
  };
};
