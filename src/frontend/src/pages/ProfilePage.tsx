import { useState } from 'react';
import { useGetPostedStories, useGetLikedStories, useGetPinnedStories } from '../hooks/useQueries';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import StoryCard from '../components/StoryCard';
import type { StoryView } from '../backend';

interface ProfilePageProps {
  onBackHome: () => void;
}

export default function ProfilePage({ onBackHome }: ProfilePageProps) {
  const [selectedStory, setSelectedStory] = useState<StoryView | null>(null);

  const {
    data: postedStories = [],
    isLoading: postedLoading,
    error: postedError,
    refetch: refetchPosted,
  } = useGetPostedStories();

  const {
    data: likedStories = [],
    isLoading: likedLoading,
    error: likedError,
    refetch: refetchLiked,
  } = useGetLikedStories();

  const {
    data: pinnedStories = [],
    isLoading: pinnedLoading,
    error: pinnedError,
    refetch: refetchPinned,
  } = useGetPinnedStories();

  const renderStoryGrid = (
    stories: StoryView[],
    isLoading: boolean,
    error: Error | null,
    emptyMessage: string,
    refetch: () => void
  ) => {
    if (isLoading) {
      return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Failed to load stories. Please try again.</span>
            <Button variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    if (stories.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <svg
              className="h-12 w-12 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">{emptyMessage}</h3>
        </div>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stories.map((story) => (
          <StoryCard
            key={story.id}
            story={story}
            userLocation={null}
            onClick={() => setSelectedStory(story)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="container px-4 py-6">
      <div className="mb-6">
        <Button variant="ghost" onClick={onBackHome} className="gap-2 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Button>
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="text-muted-foreground mt-2">View your posted stories, likes, and pins</p>
      </div>

      <Tabs defaultValue="posted" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="posted">Posted</TabsTrigger>
          <TabsTrigger value="likes">Likes</TabsTrigger>
          <TabsTrigger value="pins">Pins</TabsTrigger>
        </TabsList>

        <TabsContent value="posted">
          {renderStoryGrid(
            postedStories,
            postedLoading,
            postedError as Error | null,
            'No stories posted yet.',
            refetchPosted
          )}
        </TabsContent>

        <TabsContent value="likes">
          {renderStoryGrid(
            likedStories,
            likedLoading,
            likedError as Error | null,
            'No liked stories yet.',
            refetchLiked
          )}
        </TabsContent>

        <TabsContent value="pins">
          {renderStoryGrid(
            pinnedStories,
            pinnedLoading,
            pinnedError as Error | null,
            'No pinned stories yet.',
            refetchPinned
          )}
        </TabsContent>
      </Tabs>

      {/* Story Detail Dialog - reuse existing component */}
      {selectedStory && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4"
              onClick={() => setSelectedStory(null)}
            >
              <span className="sr-only">Close</span>
              ×
            </Button>
            <div className="max-h-[80vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">{selectedStory.title}</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{selectedStory.content}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
