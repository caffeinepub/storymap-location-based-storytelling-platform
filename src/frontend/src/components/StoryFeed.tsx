import StoryCard from './StoryCard';
import { Skeleton } from '@/components/ui/skeleton';
import type { Story } from '../backend';

interface StoryFeedProps {
  stories: Story[];
  isLoading: boolean;
  userLocation: { latitude: number; longitude: number } | null;
  onStoryClick: (story: Story) => void;
}

export default function StoryFeed({ stories, isLoading, userLocation, onStoryClick }: StoryFeedProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-lg" />
        ))}
      </div>
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
        <h3 className="text-lg font-semibold mb-2">No stories found</h3>
        <p className="text-muted-foreground max-w-sm">
          Be the first to share a story in your area! Click the + button to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {stories.map((story) => (
        <StoryCard
          key={story.id}
          story={story}
          userLocation={userLocation}
          onClick={() => onStoryClick(story)}
        />
      ))}
    </div>
  );
}
