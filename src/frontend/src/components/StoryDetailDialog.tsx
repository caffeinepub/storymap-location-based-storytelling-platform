import { useState, useEffect, useRef } from 'react';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import {
  useLikeStory,
  useUnlikeStory,
  usePinStory,
  useUnpinStory,
  useGetComments,
  useAddComment,
  useReportStory,
  useRemoveStory,
  useGetCallerUserProfile,
  useIsCallerAdmin,
  useIncrementStoryViewCount,
} from '../hooks/useQueries';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Heart, MapPin as PinIcon, MessageCircle, Share2, Flag, Loader2, Trash2, Eye } from 'lucide-react';
import type { Story } from '../backend';
import { calculateDistance, formatDistance } from '../lib/utils';
import { getCategoryLabel, getCategoryColor } from '../lib/categories';
import { toast } from 'sonner';

interface StoryDetailDialogProps {
  story: Story | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userLocation: { latitude: number; longitude: number } | null;
  onStoryDeleted?: () => void;
}

export default function StoryDetailDialog({
  story,
  open,
  onOpenChange,
  userLocation,
  onStoryDeleted,
}: StoryDetailDialogProps) {
  const { identity } = useInternetIdentity();
  const [commentText, setCommentText] = useState('');
  const [commentAnonymous, setCommentAnonymous] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [deleteIconError, setDeleteIconError] = useState(false);
  const viewRecordedRef = useRef<string | null>(null);

  const { data: userProfile, isLoading: profileLoading } = useGetCallerUserProfile();
  const { data: isAdmin = false, isLoading: adminLoading } = useIsCallerAdmin();
  const { data: comments = [], refetch: refetchComments } = useGetComments(story?.id || null);
  const likeMutation = useLikeStory();
  const unlikeMutation = useUnlikeStory();
  const pinMutation = usePinStory();
  const unpinMutation = useUnpinStory();
  const addCommentMutation = useAddComment();
  const reportMutation = useReportStory();
  const removeMutation = useRemoveStory();
  const incrementViewMutation = useIncrementStoryViewCount();

  useEffect(() => {
    if (story?.image) {
      setImageUrl(story.image.getDirectURL());
    } else {
      setImageUrl(null);
    }
  }, [story?.image]);

  useEffect(() => {
    if (!open) {
      setCommentText('');
      setCommentAnonymous(false);
      setShowCommentInput(false);
      setCommentError(null);
      viewRecordedRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (open && story?.id) {
      refetchComments();
      
      // Record view count exactly once per dialog open, only when authenticated
      if (identity && viewRecordedRef.current !== story.id) {
        viewRecordedRef.current = story.id;
        incrementViewMutation.mutate(story.id);
      }
    }
  }, [open, story?.id, identity, refetchComments, incrementViewMutation]);

  if (!story) return null;

  const distance = userLocation
    ? calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        story.location.latitude,
        story.location.longitude
      )
    : null;

  const isAuthenticated = !!identity;
  const isAuthor = identity && story.author.toString() === identity.getPrincipal().toString();
  
  // Show delete button if user is authenticated AND (is author OR is admin)
  // Don't hide it during admin loading if we already know user is author
  const canDelete = isAuthenticated && (isAuthor || isAdmin);
  const showDeleteButton = isAuthenticated && (isAuthor || (!adminLoading && isAdmin));

  const hasLiked = userProfile?.likedStories.includes(story.id) || false;
  const hasPinned = userProfile?.pinnedStories.includes(story.id) || false;

  const handleLike = async () => {
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

  const handlePin = async () => {
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

  const handleShare = async () => {
    const shareUrl = window.location.href;
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

  const handleAddComment = async () => {
    if (!isAuthenticated) {
      toast.error('Please log in to comment');
      return;
    }
    if (!commentText.trim()) return;

    setCommentError(null);
    try {
      await addCommentMutation.mutateAsync({
        storyId: story.id,
        content: commentText.trim(),
        isAnonymous: commentAnonymous,
      });
      setCommentText('');
      setCommentAnonymous(false);
      setShowCommentInput(false);
      // Refetch comments to show the new one immediately
      await refetchComments();
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to add comment. Please try again.';
      setCommentError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleReport = async () => {
    if (!reportReason.trim()) return;
    
    try {
      await reportMutation.mutateAsync({ storyId: story.id, reason: reportReason.trim() });
      setShowReportDialog(false);
      setReportReason('');
    } catch (error) {
      // Error already handled by mutation
    }
  };

  const handleDelete = async () => {
    try {
      await removeMutation.mutateAsync(story.id);
      setShowDeleteDialog(false);
      onOpenChange(false);
      if (onStoryDeleted) {
        onStoryDeleted();
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to delete story';
      if (errorMessage.includes('Unauthorized') || errorMessage.includes('permission')) {
        toast.error('You do not have permission to delete this story');
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const isLikeLoading = likeMutation.isPending || unlikeMutation.isPending;
  const isPinLoading = pinMutation.isPending || unpinMutation.isPending;
  const isInteractionDisabled = !isAuthenticated || profileLoading;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden pointer-events-auto">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
            <div className="flex items-start justify-between gap-4">
              <DialogTitle className="text-2xl pr-8">{story.title}</DialogTitle>
              <Badge variant="secondary" className={getCategoryColor(story.category)}>
                {getCategoryLabel(story.category)}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{story.isAnonymous ? 'Anonymous' : 'User'}</span>
              {distance !== null && (
                <span className="flex items-center gap-1">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {formatDistance(distance)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {Number(story.viewCount)} Views
              </span>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
            <div className="space-y-6">
              {imageUrl && (
                <div className="w-full rounded-lg overflow-hidden">
                  <img
                    src={imageUrl}
                    alt={story.title}
                    className="w-full max-h-96 object-contain bg-muted"
                  />
                </div>
              )}

              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-base leading-relaxed whitespace-pre-wrap break-words">
                  {story.content}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={hasLiked ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleLike}
                  disabled={isLikeLoading || isInteractionDisabled}
                  className="gap-2"
                >
                  {isLikeLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Heart className={`h-4 w-4 ${hasLiked ? 'fill-current' : ''}`} />
                  )}
                  {Number(story.likeCount)}
                </Button>
                <Button
                  variant={hasPinned ? 'default' : 'outline'}
                  size="sm"
                  onClick={handlePin}
                  disabled={isPinLoading || isInteractionDisabled}
                  className="gap-2"
                >
                  {isPinLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PinIcon className={`h-4 w-4 ${hasPinned ? 'fill-current' : ''}`} />
                  )}
                  {Number(story.pinCount)}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!isAuthenticated) {
                      toast.error('Please log in to comment');
                      return;
                    }
                    setShowCommentInput(!showCommentInput);
                  }}
                  className="gap-2"
                  disabled={isInteractionDisabled}
                >
                  <MessageCircle className="h-4 w-4" />
                  Comment
                </Button>
                <Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
                {!isAuthor && isAuthenticated && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowReportDialog(true)}
                    className="gap-2"
                  >
                    <Flag className="h-4 w-4" />
                    Report
                  </Button>
                )}
                {showDeleteButton && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteDialog(true)}
                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={removeMutation.isPending}
                  >
                    {removeMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : deleteIconError ? (
                      <Trash2 className="h-4 w-4" />
                    ) : (
                      <img 
                        src="/assets/generated/delete-story-icon.dim_32x32.png" 
                        alt="Delete" 
                        className="h-4 w-4"
                        onError={() => setDeleteIconError(true)}
                      />
                    )}
                    Delete
                  </Button>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Comments ({comments.length})
                </h3>

                {showCommentInput && isAuthenticated && (
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                    <Textarea
                      placeholder="Add a comment..."
                      value={commentText}
                      onChange={(e) => {
                        setCommentText(e.target.value);
                        setCommentError(null);
                      }}
                      rows={3}
                      className="bg-background pointer-events-auto"
                    />
                    {commentError && (
                      <p className="text-sm text-destructive">{commentError}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="comment-anonymous"
                          checked={commentAnonymous}
                          onCheckedChange={setCommentAnonymous}
                        />
                        <Label htmlFor="comment-anonymous" className="text-sm">
                          Post anonymously
                        </Label>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowCommentInput(false);
                            setCommentText('');
                            setCommentAnonymous(false);
                            setCommentError(null);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleAddComment}
                          disabled={!commentText.trim() || addCommentMutation.isPending}
                        >
                          {addCommentMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Posting...
                            </>
                          ) : (
                            'Post Comment'
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={Number(comment.id)} className="rounded-lg border p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {comment.isAnonymous ? 'Anonymous' : 'User'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(Number(comment.timestamp) / 1000000).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No comments yet. Be the first to comment!
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <AlertDialogContent className="pointer-events-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Report Story</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for reporting this story. Our team will review it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for reporting..."
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            rows={4}
            className="pointer-events-auto"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReport}
              disabled={!reportReason.trim() || reportMutation.isPending}
            >
              {reportMutation.isPending ? 'Reporting...' : 'Submit Report'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="pointer-events-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete Story</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this story? <strong>This action cannot be undone.</strong> The story and all its comments will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={removeMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive"
            >
              {removeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete Permanently'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
