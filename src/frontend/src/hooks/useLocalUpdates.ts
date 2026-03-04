import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LocalCategory, LocalUpdatePublic } from "../backend";
import type { ExternalBlob } from "../backend";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";

/** Simple lat/lng shape used throughout the frontend */
interface LatLng {
  latitude: number;
  longitude: number;
}

// Helper function to wait for actor with timeout
async function waitForActor(
  getActor: () => any,
  maxAttempts = 10,
  delayMs = 300,
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const actor = getActor();
    if (actor) return actor;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error("Backend connection not available. Please try again.");
}

// Shared query key factory for Local Updates
const localUpdatesKeys = {
  all: ["localUpdates"] as const,
  allActive: () => [...localUpdatesKeys.all, "all"] as const,
  proximity: (location: LatLng | null) =>
    [
      ...localUpdatesKeys.all,
      "proximity",
      location?.latitude,
      location?.longitude,
    ] as const,
  category: (category: LocalCategory | null) =>
    [...localUpdatesKeys.all, "category", category] as const,
};

// Create Local Update
export function useAddLocalUpdate() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      content: string;
      latitude: number;
      longitude: number;
      radius: number;
      category: LocalCategory;
      image?: ExternalBlob | null;
    }) => {
      if (!identity) {
        throw new Error("Please log in to create a local update");
      }

      const readyActor = await waitForActor(() => actor);
      return readyActor.addLocalUpdate(
        params.content,
        params.latitude,
        params.longitude,
        BigInt(params.radius),
        params.category,
        params.image || null,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: localUpdatesKeys.all });
      queryClient.refetchQueries({ queryKey: localUpdatesKeys.all });
      toast.success("Local update posted successfully!");
    },
    onError: (error: Error) => {
      const message = error.message || "Failed to create local update";
      if (message.includes("Invalid radius")) {
        toast.error("Radius must be between 200-1000 meters");
      } else if (
        message.includes("not available") ||
        message.includes("connection")
      ) {
        toast.error(
          "Connection issue. Please check your authentication and try again.",
        );
      } else {
        toast.error(message);
      }
    },
  });
}

// Get all active local updates
export function useGetAllActiveLocalUpdates() {
  const { actor, isFetching } = useActor();

  return useQuery<LocalUpdatePublic[]>({
    queryKey: localUpdatesKeys.allActive(),
    queryFn: async () => {
      if (!actor) return [];
      try {
        return await actor.getAllActiveLocalUpdates();
      } catch (error) {
        console.error("Failed to fetch local updates:", error);
        return [];
      }
    },
    enabled: !!actor && !isFetching,
    retry: false,
  });
}

// Get active local updates by proximity — passes latitude and longitude as separate args
export function useGetActiveLocalUpdatesByProximity(location: LatLng | null) {
  const { actor, isFetching } = useActor();

  return useQuery<LocalUpdatePublic[]>({
    queryKey: localUpdatesKeys.proximity(location),
    queryFn: async () => {
      if (!actor || !location) return [];
      try {
        // Backend expects two separate number arguments: latitude, longitude
        return await actor.getActiveLocalUpdatesByProximity(
          location.latitude,
          location.longitude,
        );
      } catch (error) {
        console.error("Failed to fetch local updates by proximity:", error);
        return [];
      }
    },
    enabled: !!actor && !isFetching && !!location,
    retry: false,
  });
}

// Get local updates by category
export function useGetLocalUpdatesByCategory(category: LocalCategory | null) {
  const { actor, isFetching } = useActor();

  return useQuery<LocalUpdatePublic[]>({
    queryKey: localUpdatesKeys.category(category),
    queryFn: async () => {
      if (!actor || !category) return [];
      try {
        return await actor.getLocalUpdatesByCategory(category);
      } catch (error) {
        console.error("Failed to fetch local updates by category:", error);
        return [];
      }
    },
    enabled: !!actor && !isFetching && !!category,
    retry: false,
  });
}

// Thumbs up Local Update
export function useThumbsUpLocalUpdate() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updateId: bigint) => {
      if (!identity) {
        throw new Error("Please log in to give a thumbs up");
      }

      const readyActor = await waitForActor(() => actor);
      return readyActor.thumbsUpLocalUpdate(updateId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: localUpdatesKeys.all });
      queryClient.refetchQueries({ queryKey: localUpdatesKeys.all });
    },
    onError: (error: Error) => {
      const message = error.message || "Failed to give thumbs up";
      if (message.includes("already given a thumbs-up")) {
        toast.error("You have already given a thumbs up for this update");
      } else if (
        message.includes("Unauthorized") ||
        message.includes("authenticated")
      ) {
        toast.error("Please log in to give a thumbs up");
      } else {
        toast.error(message);
      }
    },
  });
}

// Remove local update
export function useRemoveLocalUpdate() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updateId: bigint) => {
      const readyActor = await waitForActor(() => actor);
      return readyActor.removeLocalUpdate(updateId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: localUpdatesKeys.all });
      queryClient.refetchQueries({ queryKey: localUpdatesKeys.all });
      toast.success("Local update removed successfully");
    },
    onError: (error: Error) => {
      const message = error.message || "Failed to remove local update";
      if (
        message.includes("Unauthorized") ||
        message.includes("author") ||
        message.includes("admin")
      ) {
        toast.error("You do not have permission to remove this update");
      } else {
        toast.error(message);
      }
    },
  });
}
