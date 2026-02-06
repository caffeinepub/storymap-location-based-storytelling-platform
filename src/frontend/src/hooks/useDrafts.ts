import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useInternetIdentity } from './useInternetIdentity';
import type { StoryDraft, Category, Location, ExternalBlob } from '../backend';
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

// List all drafts for the current user
export function useListDrafts() {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity, isInitializing } = useInternetIdentity();

  return useQuery<StoryDraft[]>({
    queryKey: ['drafts'],
    queryFn: async () => {
      if (!actor) return [];
      try {
        return await actor.listDrafts();
      } catch (error) {
        console.error('Failed to fetch drafts:', error);
        return [];
      }
    },
    enabled: !!actor && !actorFetching && !!identity && !isInitializing,
    retry: false,
  });
}

// Get a single draft by ID
export function useGetDraft(draftId: string | null) {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity, isInitializing } = useInternetIdentity();

  return useQuery<StoryDraft | null>({
    queryKey: ['draft', draftId],
    queryFn: async () => {
      if (!actor || !draftId) return null;
      try {
        return await actor.getDraft(draftId);
      } catch (error) {
        console.error('Failed to fetch draft:', error);
        return null;
      }
    },
    enabled: !!actor && !actorFetching && !!identity && !isInitializing && !!draftId,
    retry: false,
  });
}

// Create a new draft
export function useCreateDraft() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      title: string;
      content: string;
      category: Category;
      location: Location | null;
      isAnonymous: boolean;
      image: ExternalBlob | null;
    }) => {
      if (!identity) {
        throw new Error('Please log in to save drafts');
      }

      const readyActor = await waitForActor(() => actor);
      return readyActor.createDraft(
        params.title,
        params.content,
        params.category,
        params.location,
        params.isAnonymous,
        params.image
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      toast.success('Draft saved successfully');
    },
    onError: (error: Error) => {
      const message = error.message || 'Failed to save draft';
      toast.error(message);
    },
  });
}

// Update an existing draft
export function useUpdateDraft() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      draftId: string;
      title: string;
      content: string;
      category: Category;
      location: Location | null;
      isAnonymous: boolean;
      image: ExternalBlob | null;
    }) => {
      if (!identity) {
        throw new Error('Please log in to update drafts');
      }

      const readyActor = await waitForActor(() => actor);
      return readyActor.updateDraft(
        params.draftId,
        params.title,
        params.content,
        params.category,
        params.location,
        params.isAnonymous,
        params.image
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      queryClient.invalidateQueries({ queryKey: ['draft', variables.draftId] });
      toast.success('Draft updated successfully');
    },
    onError: (error: Error) => {
      const message = error.message || 'Failed to update draft';
      toast.error(message);
    },
  });
}

// Delete a draft
export function useDeleteDraft() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draftId: string) => {
      if (!identity) {
        throw new Error('Please log in to delete drafts');
      }

      const readyActor = await waitForActor(() => actor);
      return readyActor.deleteDraft(draftId);
    },
    onSuccess: (_, draftId) => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      queryClient.removeQueries({ queryKey: ['draft', draftId] });
      toast.success('Draft deleted successfully');
    },
    onError: (error: Error) => {
      const message = error.message || 'Failed to delete draft';
      toast.error(message);
    },
  });
}

// Publish a draft (converts it to a story)
export function usePublishDraft() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draftId: string) => {
      if (!identity) {
        throw new Error('Please log in to publish drafts');
      }

      const readyActor = await waitForActor(() => actor);
      return readyActor.publishDraft(draftId);
    },
    onSuccess: (_, draftId) => {
      // Invalidate drafts list
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      queryClient.removeQueries({ queryKey: ['draft', draftId] });
      
      // Invalidate story feeds so the newly published story appears
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      queryClient.invalidateQueries({ queryKey: ['postedStories'] });
      
      toast.success('Draft published successfully!');
    },
    onError: (error: Error) => {
      const message = error.message || 'Failed to publish draft';
      if (message.includes('must have a location')) {
        toast.error('Please add a location before publishing');
      } else {
        toast.error(message);
      }
    },
  });
}

// Combined save draft mutation (creates or updates based on whether draftId exists)
export function useSaveDraft() {
  const createMutation = useCreateDraft();
  const updateMutation = useUpdateDraft();

  return {
    mutate: (params: {
      draftId?: string;
      title: string;
      content: string;
      category: Category;
      location: Location | null;
      isAnonymous: boolean;
      image: ExternalBlob | null;
    }) => {
      if (params.draftId) {
        updateMutation.mutate({
          draftId: params.draftId,
          title: params.title,
          content: params.content,
          category: params.category,
          location: params.location,
          isAnonymous: params.isAnonymous,
          image: params.image,
        });
      } else {
        createMutation.mutate({
          title: params.title,
          content: params.content,
          category: params.category,
          location: params.location,
          isAnonymous: params.isAnonymous,
          image: params.image,
        });
      }
    },
    isPending: createMutation.isPending || updateMutation.isPending,
    isError: createMutation.isError || updateMutation.isError,
    isSuccess: createMutation.isSuccess || updateMutation.isSuccess,
  };
}
