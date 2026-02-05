import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useInternetIdentity } from './useInternetIdentity';
import type { Story, UserProfile, Comment, Category, Location, ExternalBlob } from '../backend';
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

// Story Queries
export function useGetRecentStories(amount: number = 50) {
  const { actor, isFetching } = useActor();

  return useQuery<Story[]>({
    queryKey: ['stories', 'recent', amount],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getRecentStories(BigInt(amount));
    },
    enabled: !!actor && !isFetching,
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

export function useGetStoriesByCategory(category: Category | null) {
  const { actor, isFetching } = useActor();

  return useQuery<Story[]>({
    queryKey: ['stories', 'category', category],
    queryFn: async () => {
      if (!actor || !category) return [];
      return actor.getStoriesByCategory(category);
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
      queryClient.invalidateQueries({ queryKey: ['hasSeenIntro'] });
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
      const previousStories = queryClient.getQueryData(['stories', 'recent', 50]);
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

      // Optimistically update stories list
      queryClient.setQueryData(['stories', 'recent', 50], (old: Story[] | undefined) => {
        if (!old) return old;
        return old.map(story => 
          story.id === storyId 
            ? { ...story, likeCount: story.likeCount + BigInt(1) }
            : story
        );
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
      if (context?.previousStories) {
        queryClient.setQueryData(['stories', 'recent', 50], context.previousStories);
      }
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

      const previousStories = queryClient.getQueryData(['stories', 'recent', 50]);
      const previousStory = queryClient.getQueryData(['story', storyId]);
      const previousProfile = queryClient.getQueryData(['currentUserProfile']);

      queryClient.setQueryData(['story', storyId], (old: Story | undefined) => {
        if (!old) return old;
        return {
          ...old,
          likeCount: old.likeCount > BigInt(0) ? old.likeCount - BigInt(1) : BigInt(0),
        };
      });

      queryClient.setQueryData(['stories', 'recent', 50], (old: Story[] | undefined) => {
        if (!old) return old;
        return old.map(story => 
          story.id === storyId 
            ? { ...story, likeCount: story.likeCount > BigInt(0) ? story.likeCount - BigInt(1) : BigInt(0) }
            : story
        );
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
      if (context?.previousStories) {
        queryClient.setQueryData(['stories', 'recent', 50], context.previousStories);
      }
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

      const previousStories = queryClient.getQueryData(['stories', 'recent', 50]);
      const previousStory = queryClient.getQueryData(['story', storyId]);
      const previousProfile = queryClient.getQueryData(['currentUserProfile']);

      queryClient.setQueryData(['story', storyId], (old: Story | undefined) => {
        if (!old) return old;
        return {
          ...old,
          pinCount: old.pinCount + BigInt(1),
        };
      });

      queryClient.setQueryData(['stories', 'recent', 50], (old: Story[] | undefined) => {
        if (!old) return old;
        return old.map(story => 
          story.id === storyId 
            ? { ...story, pinCount: story.pinCount + BigInt(1) }
            : story
        );
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
      if (context?.previousStories) {
        queryClient.setQueryData(['stories', 'recent', 50], context.previousStories);
      }
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

      const previousStories = queryClient.getQueryData(['stories', 'recent', 50]);
      const previousStory = queryClient.getQueryData(['story', storyId]);
      const previousProfile = queryClient.getQueryData(['currentUserProfile']);

      queryClient.setQueryData(['story', storyId], (old: Story | undefined) => {
        if (!old) return old;
        return {
          ...old,
          pinCount: old.pinCount > BigInt(0) ? old.pinCount - BigInt(1) : BigInt(0),
        };
      });

      queryClient.setQueryData(['stories', 'recent', 50], (old: Story[] | undefined) => {
        if (!old) return old;
        return old.map(story => 
          story.id === storyId 
            ? { ...story, pinCount: story.pinCount > BigInt(0) ? story.pinCount - BigInt(1) : BigInt(0) }
            : story
        );
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
      if (context?.previousStories) {
        queryClient.setQueryData(['stories', 'recent', 50], context.previousStories);
      }
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
      toast.success('Story removed successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove story');
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
      const message = error.message || 'Failed to add comment';
      if (!message.includes('log in')) {
        toast.error(message);
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
