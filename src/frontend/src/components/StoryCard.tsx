import { useState, useEffect } from 'react';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import {
  useLikeStory,
  useUnlikeStory,
  usePinStory,
  useUnpinStory,
  useGetCallerUserProfile,
} from '../hooks/useQueries';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, MapPin as PinIcon, MessageCircle, Share2, Loader2, Eye } from 'lucide-react';
import type { Story } from '../backend';
import { calculateDistance, formatDistance } from '../lib/utils';
import { getCategoryLabel, getCategoryColor } from '../lib/categories';
import { toast } from 'sonner';

interface StoryCardProps {
  story: Story;
  userLocation: { latitude: number; longitude: number } | null;
  onClick: () => void;
}

export default function StoryCard({ story, userLocation, onClick }: StoryCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const { identity, isInitializing } = useInternetIdentity();
  const { data: userProfile, isLoading: profileLoading } = useGetCallerUserProfile();
  const likeMutation = useLikeStory();
  const unlikeMutation = useUnlikeStory();
  const pinMutation = usePinStory();
  const unpinMutation = useUnpinStory();

  useEffect(() => {
    if (story.image) {
      setImageUrl(story.image.getDirectURL());
    } else {
      // Clear image URL when story has no image to prevent stale UI
      setImageUrl(null);
    }
  }, [story.image]);

  const distance = userLocation
    ? calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        story.location.latitude,
        story.location.longitude
      )
    : null;

  const preview = story.content.length > 120 ? story.content.slice(0, 120) + '...' : story.content;

  const isAuthenticated = !!identity && !isInitializing;
  const hasLiked = userProfile?.likedStories.includes(story.id) || false;
  const hasPinned = userProfile?.pinnedStories.includes(story.id) || false;
  const isInteractionDisabled = !isAuthenticated || profileLoading;

  const isLikeLoading = likeMutation.isPending || unlikeMutation.isPending;
  const isPinLoading = pinMutation.isPending || unpinMutation.isPending;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.error('Please log in to like stories');
      return;
    }
    
    try {
      if (hasLiked) {
        await unlikeMutation.mutateAsync(story.id);
      } else {
        await likeMutation.mutateAsync(story.id);
      }
    } catch (error) {
      // Error already handled by mutation
    }
  };

  const handlePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.error('Please log in to pin stories');
      return;
    }
    
    try {
      if (hasPinned) {
        await unpinMutation.mutateAsync(story.id);
      } else {
        await pinMutation.mutateAsync(story.id);
      }
    } catch (error) {
      // Error already handled by mutation
    }
  };

  const handleComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.error('Please log in to comment');
      return;
    }
    onClick();
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = window.location.origin + '/?story=' + story.id;
    const shareData = {
      title: story.title,
      text: story.content.substring(0, 100) + (story.content.length > 100 ? '...' : ''),
      url: shareUrl,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        toast.success('Story shared successfully!');
        return;
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Share failed:', error);
        }
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard!');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 flex flex-col"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {imageUrl && (
        <div className="w-full h-48 overflow-hidden rounded-t-lg">
          <img
            src={imageUrl}
            alt={story.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-lg line-clamp-2">{story.title}</h3>
          <Badge variant="secondary" className={getCategoryColor(story.category)}>
            {getCategoryLabel(story.category)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-sm text-muted-foreground line-clamp-3">{preview}</p>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 pt-4">
        <div className="flex items-center gap-2 w-full">
          <Button
            variant={hasLiked ? 'default' : 'outline'}
            size="sm"
            onClick={handleLike}
            disabled={isLikeLoading || isInteractionDisabled}
            className="gap-1.5 flex-1"
          >
            {isLikeLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Heart className={`h-4 w-4 ${hasLiked ? 'fill-current' : ''}`} />
            )}
            <span className="text-xs">{Number(story.likeCount)}</span>
          </Button>
          <Button
            variant={hasPinned ? 'default' : 'outline'}
            size="sm"
            onClick={handlePin}
            disabled={isPinLoading || isInteractionDisabled}
            className="gap-1.5 flex-1"
          >
            {isPinLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PinIcon className={`h-4 w-4 ${hasPinned ? 'fill-current' : ''}`} />
            )}
            <span className="text-xs">{Number(story.pinCount)}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleComment}
            disabled={isInteractionDisabled}
            className="gap-1.5 flex-1"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="gap-1.5 flex-1"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
          {distance !== null && (
            <div className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{formatDistance(distance)}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            <span>{Number(story.viewCount)} Views</span>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
