import Storage "blob-storage/Storage";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Time "mo:core/Time";

module {
  public type OldLocalUpdate = {
    id : Nat;
    content : Text;
    latitude : Float;
    longitude : Float;
    radius : Nat;
    timestamp : Int;
    category : {
      #traffic;
      #power;
      #police;
      #event;
      #nature;
      #general;
    };
    author : Principal;
  };

  public type OldActor = {
    nextLocalUpdateId : Nat;
    localUpdates : Map.Map<Nat, OldLocalUpdate>;
    lastCleanupTimestamp : Time.Time;
  };

  public type NewLocalUpdate = {
    id : Nat;
    content : Text;
    latitude : Float;
    longitude : Float;
    radius : Nat;
    timestamp : Int;
    category : {
      #traffic;
      #power;
      #police;
      #event;
      #nature;
      #general;
    };
    author : Principal;
    image : ?Storage.ExternalBlob;
  };

  public type NewActor = {
    nextLocalUpdateId : Nat;
    localUpdates : Map.Map<Nat, NewLocalUpdate>;
    lastCleanupTimestamp : Time.Time;
  };

  public func run(old : OldActor) : NewActor {
    let newLocalUpdates = old.localUpdates.map<Nat, OldLocalUpdate, NewLocalUpdate>(
      func(_id, oldUpdate) {
        { oldUpdate with image = null };
      }
    );
    {
      old with
      localUpdates = newLocalUpdates;
    };
  };
};
