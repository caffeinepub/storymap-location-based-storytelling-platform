import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useInternetIdentity } from './useInternetIdentity';
import type { Story, UserProfile, Comment, Category, Location, ExternalBlob, SearchParams, StoryView, Report } from '../backend';
import type { SortOption } from '../lib/storySorting';
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
    staleTime: 5 * 60 * 1000, // Keep admin status stable for 5 minutes
    gcTime: 10 * 60 * 1000, // Cache for 10 minutes
    placeholderData: (previousData) => previousData, // Preserve last known value during refetch
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
  coordinates: Location | null;
  sortOption: SortOption;
  nearestOrigin?: Location | null;
}) {
  const { actor, isFetching } = useActor();

  // Build search params for backend
  const searchParams: SearchParams | null = params.coordinates
    ? {
        keywords: params.keywords || undefined,
        category: params.category || undefined,
        radius: params.radius || undefined,
        coordinates: params.coordinates,
        sort: toBackendSortOption(params.sortOption, params.nearestOrigin),
      }
    : null;

  // Create stable query key that includes sort option
  const queryKey = [
    'stories',
    'search',
    params.keywords,
    params.category,
    params.radius,
    params.coordinates,
    params.sortOption,
    params.nearestOrigin,
  ];

  return useQuery<Story[]>({
    queryKey,
    queryFn: async () => {
      if (!actor) return [];
      
      // If no coordinates, use a default center point (0,0) with large radius to get all stories
      // Then apply client-side filtering and sorting
      if (!searchParams) {
        try {
          const fallbackParams: SearchParams = {
            coordinates: { latitude: 0, longitude: 0 },
            radius: 20000, // Large radius to get all stories
            sort: toBackendSortOption(params.sortOption, params.nearestOrigin),
          };
          
          const allStories = await actor.searchStories(fallbackParams);
          
          // Apply client-side category filtering
          const filtered = allStories.filter((story) => {
            if (params.category && story.category !== params.category) return false;
            return true;
          });

          // Apply client-side sorting (nearest will be unavailable/disabled in UI when no coordinates)
          return sortStories(filtered, params.sortOption, params.nearestOrigin);
        } catch (error) {
          console.error('Fallback search failed:', error);
          return [];
        }
      }
      
      try {
        return await actor.searchStories(searchParams);
      } catch (error) {
        // Graceful degradation: return empty array on search failure
        console.error('Search failed:', error);
        return [];
      }
    },
    enabled: !!actor && !isFetching,
    retry: false,
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

export function useGetStoriesByCategory(category: Category | null, sortOption: SortOption = 'newest') {
  const { actor, isFetching } = useActor();

  return useQuery<Story[]>({
    queryKey: ['stories', 'category', category, sortOption],
    queryFn: async () => {
      if (!actor || !category) return [];
      const backendSortOption = toBackendSortOption(sortOption, null);
      return actor.getStoriesByCategory(category, backendSortOption);
    },
    enabled: !!actor && !isFetching && !!category,
  });
}

// Story Mutations
export function useCreateStory() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      title: string;
      content: string;
      category: Category;
      location: Location;
      isAnonymous: boolean;
      image: ExternalBlob | null;
    }) => {
      if (!identity) {
        throw new Error('Please log in to create a story');
      }
      
      const readyActor = await waitForActor(() => actor);
      const timestamp = BigInt(Date.now() * 1000000);
      
      // Pass image directly - null is a valid value for optional parameter
      return readyActor.createStory(
        params.title,
        params.content,
        params.category,
        params.location,
        timestamp,
        params.isAnonymous,
        params.image
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      queryClient.invalidateQueries({ queryKey: ['hasIntro'] });
      queryClient.invalidateQueries({ queryKey: ['postedStories'] });
      toast.success('Story created successfully!');
    },
    onError: (error: Error) => {
      const message = error.message || 'Failed to create story';
      if (message.includes('not available') || message.includes('connection')) {
        toast.error('Connection issue. Please check your authentication and try again.');
      } else {
        toast.error(message);
      }
    },
  });
}

export function useUpdateStory() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      storyId: string;
      title: string;
      content: string;
      category: Category;
      location: Location;
      isAnonymous: boolean;
      image: ExternalBlob | null;
    }) => {
      if (!identity) {
        throw new Error('Please log in to update a story');
      }
      
      const readyActor = await waitForActor(() => actor);
      
      return readyActor.updateStory(
        params.storyId,
        params.title,
        params.content,
        params.category,
        params.location,
        params.isAnonymous,
        params.image
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['story', variables.storyId] });
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      queryClient.invalidateQueries({ queryKey: ['postedStories'] });
      toast.success('Story updated successfully!');
    },
    onError: (error: Error) => {
      const message = error.message || 'Failed to update story';
      if (message.includes('Unauthorized') || message.includes('author') || message.includes('permission')) {
        toast.error('You do not have permission to edit this story');
      } else if (message.includes('does not exist')) {
        toast.error('Story not found');
      } else if (message.includes('not available') || message.includes('connection')) {
        toast.error('Connection issue. Please check your authentication and try again.');
      } else {
        toast.error(message);
      }
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
      // Invalidate queries to refetch updated view count
      queryClient.invalidateQueries({ queryKey: ['story', storyId] });
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
    onError: () => {
      // Silent error - view count increment is not critical and should not show user-facing errors
    },
  });
}

export function useLikeStory() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storyId: string) => {
      if (!identity) {
        throw new Error('Please log in to like stories');
      }
      const readyActor = await waitForActor(() => actor);
      return readyActor.likeStory(storyId);
    },
    onMutate: async (storyId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['stories'] });
      await queryClient.cancelQueries({ queryKey: ['story', storyId] });
      await queryClient.cancelQueries({ queryKey: ['currentUserProfile'] });

      // Snapshot previous values
      const previousStories = queryClient.getQueryData(['stories', 'search']);
      const previousStory = queryClient.getQueryData(['story', storyId]);
      const previousProfile = queryClient.getQueryData(['currentUserProfile']);

      // Optimistically update story like count
      queryClient.setQueryData(['story', storyId], (old: Story | undefined) => {
        if (!old) return old;
        return {
          ...old,
          likeCount: old.likeCount + BigInt(1),
        };
      });

      // Optimistically update user profile
      queryClient.setQueryData(['currentUserProfile'], (old: UserProfile | null | undefined) => {
        if (!old) return old;
        return {
          ...old,
          likedStories: [...old.likedStories, storyId],
        };
      });

      return { previousStories, previousStory, previousProfile };
    },
    onError: (error: Error, storyId, context) => {
      // Rollback on error
      if (context?.previousStory) {
        queryClient.setQueryData(['story', storyId], context.previousStory);
      }
      if (context?.previousProfile) {
        queryClient.setQueryData(['currentUserProfile'], context.previousProfile);
      }

      const message = error.message || 'Failed to like story';
      if (message.includes('already liked')) {
        toast.info('You already liked this story');
      } else if (!message.includes('log in')) {
        toast.error(message);
      }
    },
    onSettled: (_, __, storyId) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      queryClient.invalidateQueries({ queryKey: ['story', storyId] });
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      queryClient.invalidateQueries({ queryKey: ['likedStories'] });
    },
  });
}

export function useUnlikeStory() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storyId: string) => {
      if (!identity) {
        throw new Error('Please log in to unlike stories');
      }
      const readyActor = await waitForActor(() => actor);
      return readyActor.unlikeStory(storyId);
    },
    onMutate: async (storyId) => {
      await queryClient.cancelQueries({ queryKey: ['stories'] });
      await queryClient.cancelQueries({ queryKey: ['story', storyId] });
      await queryClient.cancelQueries({ queryKey: ['currentUserProfile'] });

      const previousStories = queryClient.getQueryData(['stories', 'search']);
      const previousStory = queryClient.getQueryData(['story', storyId]);
      const previousProfile = queryClient.getQueryData(['currentUserProfile']);

      queryClient.setQueryData(['story', storyId], (old: Story | undefined) => {
        if (!old) return old;
        return {
          ...old,
          likeCount: old.likeCount > BigInt(0) ? old.likeCount - BigInt(1) : BigInt(0),
        };
      });

      queryClient.setQueryData(['currentUserProfile'], (old: UserProfile | null | undefined) => {
        if (!old) return old;
        return {
          ...old,
          likedStories: old.likedStories.filter(id => id !== storyId),
        };
      });

      return { previousStories, previousStory, previousProfile };
    },
    onError: (error: Error, storyId, context) => {
      if (context?.previousStory) {
        queryClient.setQueryData(['story', storyId], context.previousStory);
      }
      if (context?.previousProfile) {
        queryClient.setQueryData(['currentUserProfile'], context.previousProfile);
      }

      const message = error.message || 'Failed to unlike story';
      if (message.includes('not liked')) {
        toast.info('You have not liked this story');
      } else if (!message.includes('log in')) {
        toast.error(message);
      }
    },
    onSettled: (_, __, storyId) => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      queryClient.invalidateQueries({ queryKey: ['story', storyId] });
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      queryClient.invalidateQueries({ queryKey: ['likedStories'] });
    },
  });
}

export function usePinStory() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storyId: string) => {
      if (!identity) {
        throw new Error('Please log in to pin stories');
      }
      const readyActor = await waitForActor(() => actor);
      return readyActor.pinStory(storyId);
    },
    onMutate: async (storyId) => {
      await queryClient.cancelQueries({ queryKey: ['stories'] });
      await queryClient.cancelQueries({ queryKey: ['story', storyId] });
      await queryClient.cancelQueries({ queryKey: ['currentUserProfile'] });

      const previousStories = queryClient.getQueryData(['stories', 'search']);
      const previousStory = queryClient.getQueryData(['story', storyId]);
      const previousProfile = queryClient.getQueryData(['currentUserProfile']);

      queryClient.setQueryData(['story', storyId], (old: Story | undefined) => {
        if (!old) return old;
        return {
          ...old,
          pinCount: old.pinCount + BigInt(1),
        };
      });

      queryClient.setQueryData(['currentUserProfile'], (old: UserProfile | null | undefined) => {
        if (!old) return old;
        return {
          ...old,
          pinnedStories: [...old.pinnedStories, storyId],
        };
      });

      return { previousStories, previousStory, previousProfile };
    },
    onError: (error: Error, storyId, context) => {
      if (context?.previousStory) {
        queryClient.setQueryData(['story', storyId], context.previousStory);
      }
      if (context?.previousProfile) {
        queryClient.setQueryData(['currentUserProfile'], context.previousProfile);
      }

      const message = error.message || 'Failed to pin story';
      if (message.includes('already pinned')) {
        toast.info('You already pinned this story');
      } else if (!message.includes('log in')) {
        toast.error(message);
      }
    },
    onSettled: (_, __, storyId) => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      queryClient.invalidateQueries({ queryKey: ['story', storyId] });
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      queryClient.invalidateQueries({ queryKey: ['pinnedStories'] });
    },
  });
}

export function useUnpinStory() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storyId: string) => {
      if (!identity) {
        throw new Error('Please log in to unpin stories');
      }
      const readyActor = await waitForActor(() => actor);
      return readyActor.unpinStory(storyId);
    },
    onMutate: async (storyId) => {
      await queryClient.cancelQueries({ queryKey: ['stories'] });
      await queryClient.cancelQueries({ queryKey: ['story', storyId] });
      await queryClient.cancelQueries({ queryKey: ['currentUserProfile'] });

      const previousStories = queryClient.getQueryData(['stories', 'search']);
      const previousStory = queryClient.getQueryData(['story', storyId]);
      const previousProfile = queryClient.getQueryData(['currentUserProfile']);

      queryClient.setQueryData(['story', storyId], (old: Story | undefined) => {
        if (!old) return old;
        return {
          ...old,
          pinCount: old.pinCount > BigInt(0) ? old.pinCount - BigInt(1) : BigInt(0),
        };
      });

      queryClient.setQueryData(['currentUserProfile'], (old: UserProfile | null | undefined) => {
        if (!old) return old;
        return {
          ...old,
          pinnedStories: old.pinnedStories.filter(id => id !== storyId),
        };
      });

      return { previousStories, previousStory, previousProfile };
    },
    onError: (error: Error, storyId, context) => {
      if (context?.previousStory) {
        queryClient.setQueryData(['story', storyId], context.previousStory);
      }
      if (context?.previousProfile) {
        queryClient.setQueryData(['currentUserProfile'], context.previousProfile);
      }

      const message = error.message || 'Failed to unpin story';
      if (message.includes('not pinned')) {
        toast.info('You have not pinned this story');
      } else if (!message.includes('log in')) {
        toast.error(message);
      }
    },
    onSettled: (_, __, storyId) => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      queryClient.invalidateQueries({ queryKey: ['story', storyId] });
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      queryClient.invalidateQueries({ queryKey: ['pinnedStories'] });
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
    onMutate: async (storyId) => {
      // Optimistically remove the story from all caches
      await queryClient.cancelQueries({ queryKey: ['stories'] });
      await queryClient.cancelQueries({ queryKey: ['story', storyId] });
      
      const previousStory = queryClient.getQueryData(['story', storyId]);
      
      // Remove the specific story detail cache
      queryClient.removeQueries({ queryKey: ['story', storyId] });
      
      return { previousStory };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      queryClient.invalidateQueries({ queryKey: ['postedStories'] });
      queryClient.invalidateQueries({ queryKey: ['likedStories'] });
      queryClient.invalidateQueries({ queryKey: ['pinnedStories'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success('Story deleted successfully');
    },
    onError: (error: Error, storyId, context) => {
      // Rollback on error
      if (context?.previousStory) {
        queryClient.setQueryData(['story', storyId], context.previousStory);
      }
      
      const message = error.message || 'Failed to delete story';
      if (message.includes('Unauthorized') || message.includes('author') || message.includes('admin')) {
        toast.error('You do not have permission to delete this story');
      } else {
        toast.error(message);
      }
    },
  });
}

// Comment Queries
export function useGetComments(storyId: string | null) {
  const { actor, isFetching } = useActor();

  return useQuery<Comment[]>({
    queryKey: ['comments', storyId],
    queryFn: async () => {
      if (!actor || !storyId) return [];
      return actor.getComments(storyId);
    },
    enabled: !!actor && !isFetching && !!storyId,
  });
}

export function useAddComment() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      storyId: string;
      content: string;
      isAnonymous: boolean;
    }) => {
      if (!identity) {
        throw new Error('Please log in to comment');
      }
      const readyActor = await waitForActor(() => actor);
      const timestamp = BigInt(Date.now() * 1000000);
      return readyActor.addComment(params.storyId, params.content, timestamp, params.isAnonymous);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.storyId] });
      toast.success('Comment added');
    },
    onError: (error: Error) => {
      const message = error.message || 'Failed to add comment. Please try again.';
      if (message.includes('Unauthorized')) {
        throw new Error('You must be logged in to comment');
      } else {
        throw new Error(message);
      }
    },
  });
}

// Report Mutation
export function useReportStory() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (params: { storyId: string; reason: string }) => {
      const readyActor = await waitForActor(() => actor);
      const timestamp = BigInt(Date.now() * 1000000);
      return readyActor.reportStory(params.storyId, params.reason, timestamp);
    },
    onSuccess: () => {
      toast.success('Story reported. Thank you for keeping our community safe.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to report story');
    },
  });
}

// Admin Moderation Queries
export function useGetReports() {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity, isInitializing } = useInternetIdentity();

  return useQuery<Report[]>({
    queryKey: ['reports'],
    queryFn: async () => {
      if (!actor) return [];
      try {
        return await actor.getReports();
      } catch (error: any) {
        // Handle authorization errors gracefully
        if (error.message?.includes('Unauthorized') || error.message?.includes('admin')) {
          console.warn('User is not authorized to view reports');
          return [];
        }
        throw error;
      }
    },
    enabled: !!actor && !actorFetching && !!identity && !isInitializing,
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
      const message = error.message || 'Failed to dismiss report';
      if (message.includes('Unauthorized') || message.includes('admin')) {
        toast.error('You do not have permission to dismiss reports');
      } else {
        toast.error(message);
      }
    },
  });
}
