import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Eye,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  MapPin as PinIcon,
  Share2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Story } from "../backend";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useGetCallerUserProfile,
  useLikeStory,
  usePinStory,
  useUnlikeStory,
  useUnpinStory,
} from "../hooks/useQueries";
import { getCategoryColor, getCategoryLabel } from "../lib/categories";
import { calculateDistance, formatDistance } from "../lib/utils";

interface StoryCardProps {
  story: Story;
  userLocation: { latitude: number; longitude: number } | null;
  teleportedLocation?: { latitude: number; longitude: number } | null;
  onClick: () => void;
}

export default function StoryCard({
  story,
  userLocation,
  teleportedLocation,
  onClick,
}: StoryCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const { identity, isInitializing } = useInternetIdentity();
  const { data: userProfile, isLoading: _profileLoading } =
    useGetCallerUserProfile();
  const likeMutation = useLikeStory();
  const unlikeMutation = useUnlikeStory();
  const pinMutation = usePinStory();
  const unpinMutation = useUnpinStory();

  useEffect(() => {
    if (story.image) {
      setImageUrl(story.image.getDirectURL());
    } else {
      setImageUrl(null);
    }
  }, [story.image]);

  // Determine base location for distance calculation:
  // teleportedLocation takes priority over userLocation.
  // Distance is computed against story.latitude / story.longitude (the story's pinned coordinates).
  // The uploader's location is NEVER used here.
  const baseLocation = teleportedLocation ?? userLocation;

  const distance =
    baseLocation != null &&
    typeof story.latitude === "number" &&
    typeof story.longitude === "number"
      ? calculateDistance(
          baseLocation.latitude,
          baseLocation.longitude,
          story.latitude,
          story.longitude,
        )
      : null;

  const distanceLabel = distance !== null ? formatDistance(distance) : null;

  const preview =
    story.content.length > 120
      ? `${story.content.slice(0, 120)}...`
      : story.content;

  const isAuthenticated = !!identity && !isInitializing;
  const hasLiked = userProfile?.likedStories.includes(story.id) || false;
  const hasPinned = userProfile?.pinnedStories.includes(story.id) || false;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.error("Please log in to like stories");
      return;
    }
    try {
      if (hasLiked) {
        await unlikeMutation.mutateAsync(story.id);
      } else {
        await likeMutation.mutateAsync(story.id);
      }
    } catch {
      // Error handled by mutation
    }
  };

  const handlePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.error("Please log in to pin stories");
      return;
    }
    try {
      if (hasPinned) {
        await unpinMutation.mutateAsync(story.id);
      } else {
        await pinMutation.mutateAsync(story.id);
      }
    } catch {
      // Error handled by mutation
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const isLikeLoading = likeMutation.isPending || unlikeMutation.isPending;
  const isPinLoading = pinMutation.isPending || unpinMutation.isPending;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow duration-200 overflow-hidden"
      onClick={onClick}
    >
      {imageUrl && (
        <div className="w-full">
          <img
            src={imageUrl}
            alt={story.title}
            className="w-full h-auto block object-cover max-h-48"
            onError={() => setImageUrl(null)}
          />
        </div>
      )}

      <CardHeader className="pb-2">
        {/* Location name pill */}
        {story.locationName && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{story.locationName}</span>
          </div>
        )}
        <h3 className="font-semibold text-sm leading-snug line-clamp-2">
          {story.title}
        </h3>
      </CardHeader>

      <CardContent className="pb-2">
        <p className="text-muted-foreground text-xs leading-relaxed">
          {preview}
        </p>

        <div className="flex items-center gap-2 mt-2">
          <Badge
            variant="secondary"
            className={`text-xs ${getCategoryColor(story.category)}`}
          >
            {getCategoryLabel(story.category)}
          </Badge>
          {distanceLabel && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <MapPin className="w-3 h-3" />
              {distanceLabel}
            </span>
          )}
          <span className="text-xs text-muted-foreground flex items-center gap-0.5 ml-auto">
            <Eye className="w-3 h-3" />
            {Number(story.viewCount)}
          </span>
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <div className="flex items-center gap-1 w-full">
          <Button
            variant="ghost"
            size="sm"
            className={`gap-1 h-8 px-2 text-xs ${hasLiked ? "text-rose-500" : ""}`}
            onClick={handleLike}
            disabled={isLikeLoading}
          >
            {isLikeLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Heart
                className={`w-3.5 h-3.5 ${hasLiked ? "fill-current" : ""}`}
              />
            )}
            <span>{Number(story.likeCount)}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={`gap-1 h-8 px-2 text-xs ${hasPinned ? "text-amber-500" : ""}`}
            onClick={handlePin}
            disabled={isPinLoading}
          >
            {isPinLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <PinIcon
                className={`w-3.5 h-3.5 ${hasPinned ? "fill-current" : ""}`}
              />
            )}
            <span>{Number(story.pinCount)}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1 h-8 px-2 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1 h-8 px-2 text-xs ml-auto"
            onClick={handleShare}
          >
            <Share2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
