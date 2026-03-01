import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useInternetIdentity } from './useInternetIdentity';
import type { Story, UserProfile, Comment, Category, ExternalBlob, SearchParams, StoryView, Report, MapSearchRequest } from '../backend';
import type { SortOption, LatLng } from '../lib/storySorting';
import { sortStories, toBackendSortOption } from '../lib/storySorting';
import { toast } from 'sonner';

// Helper function to wait for actor with timeout
async function waitForActor(
  getActor: () => any,
  maxAttempts: number = 10,
  delayMs: number = 300
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const actor = getActor();
    if (actor) return actor;
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw new Error('Backend connection not available. Please try again.');
}

// User Profile Queries
export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity, isInitializing } = useInternetIdentity();

  const query = useQuery<UserProfile | null>({
    queryKey: ['currentUserProfile'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching && !!identity && !isInitializing,
    retry: false,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading || isInitializing,
    isFetched: !!actor && query.isFetched && !!identity,
  };
}

export function useHasSeenIntro() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<boolean>({
    queryKey: ['hasSeenIntro'],
    queryFn: async () => {
      if (!actor) return false;
      return actor.hasSeenIntro();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });
}

export function useMarkIntroSeen() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const readyActor = await waitForActor(() => actor);
      return readyActor.markIntroSeen();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hasSeenIntro'] });
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to mark intro as seen');
    },
  });
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      const readyActor = await waitForActor(() => actor);
      return readyActor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      toast.success('Profile saved successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save profile');
    },
  });
}

// Admin check with stable state during loading
export function useIsCallerAdmin() {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity, isInitializing } = useInternetIdentity();

  return useQuery<boolean>({
    queryKey: ['isCallerAdmin'],
    queryFn: async () => {
      if (!actor) return false;
      try {
        return await actor.isCallerAdmin();
      } catch {
        return false;
      }
    },
    enabled: !!actor && !actorFetching && !!identity && !isInitializing,
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

// Profile Story Queries
export function useGetPostedStories() {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity, isInitializing } = useInternetIdentity();

  return useQuery<StoryView[]>({
    queryKey: ['postedStories', identity?.getPrincipal().toString()],
    queryFn: async () => {
      if (!actor || !identity) return [];
      try {
        return await actor.getStoriesByUser(identity.getPrincipal());
      } catch (error) {
        console.error('Failed to fetch posted stories:', error);
        return [];
      }
    },
    enabled: !!actor && !actorFetching && !!identity && !isInitializing,
    retry: false,
  });
}

export function useGetLikedStories() {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity, isInitializing } = useInternetIdentity();

  return useQuery<StoryView[]>({
    queryKey: ['likedStories', identity?.getPrincipal().toString()],
    queryFn: async () => {
      if (!actor || !identity) return [];
      try {
        return await actor.getLikedStoriesByUser(identity.getPrincipal());
      } catch (error) {
        console.error('Failed to fetch liked stories:', error);
        return [];
      }
    },
    enabled: !!actor && !actorFetching && !!identity && !isInitializing,
    retry: false,
  });
}

export function useGetPinnedStories() {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity, isInitializing } = useInternetIdentity();

  return useQuery<StoryView[]>({
    queryKey: ['pinnedStories', identity?.getPrincipal().toString()],
    queryFn: async () => {
      if (!actor || !identity) return [];
      try {
        return await actor.getPinnedStoriesByUser(identity.getPrincipal());
      } catch (error) {
        console.error('Failed to fetch pinned stories:', error);
        return [];
      }
    },
    enabled: !!actor && !actorFetching && !!identity && !isInitializing,
    retry: false,
  });
}

// Story Queries
export function useSearchStories(params: {
  keywords: string | null;
  category: Category | null;
  radius: number | null;
  coordinates: LatLng | null;
  sortOption: SortOption;
  nearestOrigin?: LatLng | null;
}) {
  const { actor, isFetching } = useActor();

  // Build search params for backend using latitude/longitude (not coordinates)
  const searchParams: SearchParams | null = params.coordinates
    ? {
        keywords: params.keywords || undefined,
        category: params.category || undefined,
        radius: params.radius || undefined,
        latitude: params.coordinates.latitude,
        longitude: params.coordinates.longitude,
        sort: toBackendSortOption(params.sortOption, params.nearestOrigin),
      }
    : null;

  const queryKey = [
    'stories',
    'search',
    params.keywords,
    params.category,
    params.radius,
    params.coordinates?.latitude,
    params.coordinates?.longitude,
    params.sortOption,
    params.nearestOrigin?.latitude,
    params.nearestOrigin?.longitude,
  ];

  return useQuery<Story[]>({
    queryKey,
    queryFn: async () => {
      if (!actor) return [];

      // If no coordinates, use a default center point with large radius to get all stories
      if (!searchParams) {
        try {
          const fallbackParams: SearchParams = {
            latitude: 0,
            longitude: 0,
            radius: 20000,
            sort: toBackendSortOption(params.sortOption, params.nearestOrigin),
          };

          const allStories = await actor.searchStories(fallbackParams);

          const filtered = allStories.filter((story: Story) => {
            if (params.category && story.category !== params.category) return false;
            return true;
          });

          return sortStories(filtered, params.sortOption, params.nearestOrigin);
        } catch (error) {
          console.error('Fallback search failed:', error);
          return [];
        }
      }

      try {
        return await actor.searchStories(searchParams);
      } catch (error) {
        console.error('Search failed:', error);
        return [];
      }
    },
    enabled: !!actor && !isFetching,
    retry: false,
  });
}

// QissaMap: Get nearby stories for map view
export function useGetNearbyStoriesForMap(center: LatLng, radiusKm: number) {
  const { actor, isFetching } = useActor();

  return useQuery<Story[]>({
    queryKey: ['nearbyStoriesForMap', center.latitude, center.longitude, radiusKm],
    queryFn: async () => {
      if (!actor) return [];

      try {
        const mapRequest: MapSearchRequest = {
          centerLatitude: center.latitude,
          centerLongitude: center.longitude,
          radius: radiusKm,
        };
        return await actor.getNearbyStoriesForMap(mapRequest);
      } catch (error) {
        console.error('Failed to fetch nearby stories for map:', error);
        return [];
      }
    },
    enabled: !!actor && !isFetching,
    retry: false,
    staleTime: 30000,
  });
}

export function useGetStoryById(id: string | null) {
  const { actor, isFetching } = useActor();

  return useQuery<Story | null>({
    queryKey: ['story', id],
    queryFn: async () => {
      if (!actor || !id) return null;
      try {
        return await actor.getStoryById(id);
      } catch {
        return null;
      }
    },
    enabled: !!actor && !isFetching && !!id,
  });
}

export function useGetComments(storyId: string | null) {
  const { actor, isFetching } = useActor();

  return useQuery<Comment[]>({
    queryKey: ['comments', storyId],
    queryFn: async () => {
      if (!actor || !storyId) return [];
      try {
        return await actor.getComments(storyId);
      } catch {
        return [];
      }
    },
    enabled: !!actor && !isFetching && !!storyId,
  });
}

// Story Mutations
export function useCreateStory() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      title: string;
      content: string;
      category: Category;
      locationName: string | null;
      latitude: number;
      longitude: number;
      isAnonymous: boolean;
      image: ExternalBlob | null;
    }) => {
      const readyActor = await waitForActor(() => actor);
      return readyActor.createStory(
        params.title,
        params.content,
        params.category,
        params.locationName,
        params.latitude,
        params.longitude,
        BigInt(Date.now() * 1000000),
        params.isAnonymous,
        params.image
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      queryClient.invalidateQueries({ queryKey: ['nearbyStoriesForMap'] });
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      queryClient.invalidateQueries({ queryKey: ['postedStories'] });
      toast.success('Story created successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create story');
    },
  });
}

export function useUpdateStory() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      storyId: string;
      title: string;
      content: string;
      category: Category;
      locationName: string | null;
      latitude: number;
      longitude: number;
      isAnonymous: boolean;
      image: ExternalBlob | null;
    }) => {
      const readyActor = await waitForActor(() => actor);
      return readyActor.updateStory(
        params.storyId,
        params.title,
        params.content,
        params.category,
        params.locationName,
        params.latitude,
        params.longitude,
        params.isAnonymous,
        params.image
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      queryClient.invalidateQueries({ queryKey: ['nearbyStoriesForMap'] });
      queryClient.invalidateQueries({ queryKey: ['story', variables.storyId] });
      queryClient.invalidateQueries({ queryKey: ['postedStories'] });
      toast.success('Story updated successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update story');
    },
  });
}

export function useIncrementStoryViewCount() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storyId: string) => {
      const readyActor = await waitForActor(() => actor);
      return readyActor.incrementStoryViewCount(storyId);
    },
    onSuccess: (_, storyId) => {
      queryClient.invalidateQueries({ queryKey: ['story', storyId] });
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      queryClient.invalidateQueries({ queryKey: ['nearbyStoriesForMap'] });
    },
    onError: (error: Error) => {
      console.error('Failed to increment view count:', error);
    },
  });
}

export function useLikeStory() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storyId: string) => {
      const readyActor = await waitForActor(() => actor);
      return readyActor.likeStory(storyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      queryClient.invalidateQueries({ queryKey: ['nearbyStoriesForMap'] });
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      queryClient.invalidateQueries({ queryKey: ['likedStories'] });
      toast.success('Story liked!');
    },
    onError: (error: Error) => {
      if (error.message.includes('already liked')) {
        toast.error('You have already liked this story');
      } else {
        toast.error(error.message || 'Failed to like story');
      }
    },
  });
}

export function useUnlikeStory() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storyId: string) => {
      const readyActor = await waitForActor(() => actor);
      return readyActor.unlikeStory(storyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      queryClient.invalidateQueries({ queryKey: ['nearbyStoriesForMap'] });
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      queryClient.invalidateQueries({ queryKey: ['likedStories'] });
      toast.success('Story unliked');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to unlike story');
    },
  });
}

export function usePinStory() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storyId: string) => {
      const readyActor = await waitForActor(() => actor);
      return readyActor.pinStory(storyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      queryClient.invalidateQueries({ queryKey: ['nearbyStoriesForMap'] });
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      queryClient.invalidateQueries({ queryKey: ['pinnedStories'] });
      toast.success('Story pinned!');
    },
    onError: (error: Error) => {
      if (error.message.includes('already pinned')) {
        toast.error('You have already pinned this story');
      } else {
        toast.error(error.message || 'Failed to pin story');
      }
    },
  });
}

export function useUnpinStory() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storyId: string) => {
      const readyActor = await waitForActor(() => actor);
      return readyActor.unpinStory(storyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      queryClient.invalidateQueries({ queryKey: ['nearbyStoriesForMap'] });
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      queryClient.invalidateQueries({ queryKey: ['pinnedStories'] });
      toast.success('Story unpinned');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to unpin story');
    },
  });
}

export function useAddComment() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      storyId: string;
      content: string;
      isAnonymous: boolean;
    }) => {
      const readyActor = await waitForActor(() => actor);
      return readyActor.addComment(
        params.storyId,
        params.content,
        BigInt(Date.now() * 1000000),
        params.isAnonymous
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.storyId] });
      toast.success('Comment added!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add comment');
    },
  });
}

export function useReportStory() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (params: { storyId: string; reason: string }) => {
      const readyActor = await waitForActor(() => actor);
      return readyActor.reportStory(
        params.storyId,
        params.reason,
        BigInt(Date.now() * 1000000)
      );
    },
    onSuccess: () => {
      toast.success('Story reported. Thank you for helping keep our community safe.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to report story');
    },
  });
}

export function useRemoveStory() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storyId: string) => {
      const readyActor = await waitForActor(() => actor);
      return readyActor.removeStory(storyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      queryClient.invalidateQueries({ queryKey: ['nearbyStoriesForMap'] });
      queryClient.invalidateQueries({ queryKey: ['postedStories'] });
      toast.success('Story deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete story');
    },
  });
}

export function useGetReports() {
  const { actor, isFetching } = useActor();
  const { identity, isInitializing } = useInternetIdentity();

  return useQuery<Report[]>({
    queryKey: ['reports'],
    queryFn: async () => {
      if (!actor) return [];
      try {
        return await actor.getReports();
      } catch (error: any) {
        if (error.message?.includes('Unauthorized') || error.message?.includes('admin')) {
          return [];
        }
        throw error;
      }
    },
    enabled: !!actor && !isFetching && !!identity && !isInitializing,
    retry: false,
  });
}

export function useRemoveReport() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportId: bigint) => {
      const readyActor = await waitForActor(() => actor);
      return readyActor.removeReport(reportId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success('Report dismissed');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to dismiss report');
    },
  });
}
