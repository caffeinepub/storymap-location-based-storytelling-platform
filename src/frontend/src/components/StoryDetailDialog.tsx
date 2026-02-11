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
  useUpdateStory,
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Heart, MapPin as PinIcon, MessageCircle, Share2, Flag, Loader2, Trash2, Eye, Edit, X, Upload } from 'lucide-react';
import type { Story, Category } from '../backend';
import { ExternalBlob, Category as CategoryEnum } from '../backend';
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

const categories: Category[] = [CategoryEnum.love, CategoryEnum.confession, CategoryEnum.funny, CategoryEnum.random, CategoryEnum.other];

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

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState<Category>(CategoryEnum.other);
  const [editLocationName, setEditLocationName] = useState('');
  const [editIsAnonymous, setEditIsAnonymous] = useState(false);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [keepExistingImage, setKeepExistingImage] = useState(true);

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
  const updateMutation = useUpdateStory();

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
      setIsEditMode(false);
      setEditImageFile(null);
      setEditImagePreview(null);
      setKeepExistingImage(true);
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

  // Initialize edit form when entering edit mode
  useEffect(() => {
    if (isEditMode && story) {
      setEditTitle(story.title);
      setEditContent(story.content);
      setEditCategory(story.category);
      setEditLocationName(story.locationName || '');
      setEditIsAnonymous(story.isAnonymous);
      setKeepExistingImage(!!story.image);
      setEditImagePreview(story.image ? story.image.getDirectURL() : null);
      setEditImageFile(null);
    }
  }, [isEditMode, story]);

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
  const canDelete = isAuthenticated && (isAuthor || isAdmin);
  const showDeleteButton = isAuthenticated && (isAuthor || (!adminLoading && isAdmin));
  
  // Show edit button only for authors
  const showEditButton = isAuthenticated && isAuthor;

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

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setEditImageFile(file);
    setKeepExistingImage(false);
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeEditImage = () => {
    setEditImageFile(null);
    setEditImagePreview(null);
    setKeepExistingImage(false);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditImageFile(null);
    setEditImagePreview(null);
    setKeepExistingImage(true);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editContent.trim()) {
      toast.error('Title and content are required');
      return;
    }

    // Determine final image value - must be ExternalBlob | null
    let finalImage: ExternalBlob | null = null;
    
    if (editImageFile) {
      // New image uploaded
      try {
        const arrayBuffer = await editImageFile.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        finalImage = ExternalBlob.fromBytes(uint8Array);
      } catch (error) {
        console.error('Failed to process image:', error);
        toast.error('Failed to process image');
        return;
      }
    } else if (keepExistingImage && story.image) {
      // Keep existing image (convert undefined to null if needed)
      finalImage = story.image;
    }
    // else: finalImage remains null (remove image)

    try {
      await updateMutation.mutateAsync({
        storyId: story.id,
        title: editTitle.trim(),
        content: editContent.trim(),
        category: editCategory,
        locationName: editLocationName.trim() || null,
        location: story.location, // Keep location unchanged
        isAnonymous: editIsAnonymous,
        image: finalImage,
      });
      setIsEditMode(false);
      setEditImageFile(null);
      setEditImagePreview(null);
      setKeepExistingImage(true);
    } catch (error) {
      // Error already handled by mutation
    }
  };

  const isLikeLoading = likeMutation.isPending || unlikeMutation.isPending;
  const isPinLoading = pinMutation.isPending || unpinMutation.isPending;
  const isCommentLoading = addCommentMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col pointer-events-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="truncate pr-4">{story.title}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {showEditButton && !isEditMode && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEditMode(true)}
                    title="Edit story"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                {showDeleteButton && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={removeMutation.isPending}
                    title="Delete story"
                  >
                    {deleteIconError ? (
                      <X className="h-4 w-4 text-destructive" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {isEditMode ? (
              // Edit Mode
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-content">Content</Label>
                  <Textarea
                    id="edit-content"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={8}
                    maxLength={2000}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {editContent.length}/2000 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <Select
                    value={editCategory}
                    onValueChange={(value) => setEditCategory(value as Category)}
                  >
                    <SelectTrigger id="edit-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {getCategoryLabel(cat)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-locationName">Location Name (Optional)</Label>
                  <Input
                    id="edit-locationName"
                    placeholder="e.g., Central Park"
                    value={editLocationName}
                    onChange={(e) => setEditLocationName(e.target.value)}
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-image">Image</Label>
                  {!editImagePreview ? (
                    <div className="flex items-center gap-2">
                      <Input
                        id="edit-image"
                        type="file"
                        accept="image/*"
                        onChange={handleEditImageChange}
                        className="flex-1"
                      />
                      <Upload className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="relative">
                      <img
                        src={editImagePreview}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={removeEditImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-anonymous">Post Anonymously</Label>
                  <Switch
                    id="edit-anonymous"
                    checked={editIsAnonymous}
                    onCheckedChange={setEditIsAnonymous}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={updateMutation.isPending}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    disabled={updateMutation.isPending}
                    className="flex-1"
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              // View Mode
              <>
                {/* Story Metadata */}
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary" className={getCategoryColor(story.category)}>
                    {getCategoryLabel(story.category)}
                  </Badge>
                  {story.isAnonymous ? (
                    <span>Anonymous</span>
                  ) : (
                    <span>By {story.author.toString().substring(0, 8)}...</span>
                  )}
                  <span>•</span>
                  <span>{new Date(Number(story.timestamp) / 1000000).toLocaleDateString()}</span>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    <span>{story.viewCount.toString()} views</span>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-center gap-2 text-sm">
                  <PinIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {distance !== null ? formatDistance(distance) : 'Location'}
                    {story.locationName && ` • ${story.locationName}`}
                  </span>
                </div>

                {/* Image */}
                {imageUrl && (
                  <div className="rounded-lg overflow-hidden">
                    <img
                      src={imageUrl}
                      alt={story.title}
                      className="w-full h-auto object-cover"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{story.content}</p>
                </div>

                <Separator />

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant={hasLiked ? 'default' : 'outline'}
                    size="sm"
                    onClick={handleLike}
                    disabled={isLikeLoading || !isAuthenticated}
                    className="flex-1"
                  >
                    <Heart className={`h-4 w-4 mr-2 ${hasLiked ? 'fill-current' : ''}`} />
                    {story.likeCount.toString()}
                  </Button>

                  <Button
                    variant={hasPinned ? 'default' : 'outline'}
                    size="sm"
                    onClick={handlePin}
                    disabled={isPinLoading || !isAuthenticated}
                    className="flex-1"
                  >
                    <PinIcon className={`h-4 w-4 mr-2 ${hasPinned ? 'fill-current' : ''}`} />
                    {story.pinCount.toString()}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCommentInput(!showCommentInput)}
                    disabled={!isAuthenticated}
                    className="flex-1"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    {comments.length}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShare}
                    className="flex-1"
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>

                  {isAuthenticated && !isAuthor && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowReportDialog(true)}
                      title="Report story"
                    >
                      <Flag className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Comment Input */}
                {showCommentInput && (
                  <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                    <Textarea
                      placeholder="Write a comment..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      rows={3}
                      maxLength={500}
                      disabled={!isAuthenticated}
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
                          disabled={!isAuthenticated}
                        />
                        <Label htmlFor="comment-anonymous" className="text-sm cursor-pointer">
                          Post anonymously
                        </Label>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleAddComment}
                        disabled={!commentText.trim() || isCommentLoading || !isAuthenticated}
                      >
                        {isCommentLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Posting...
                          </>
                        ) : (
                          'Post Comment'
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Comments List */}
                {comments.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm">Comments</h3>
                    {comments.map((comment) => (
                      <div key={comment.id.toString()} className="p-3 bg-muted/50 rounded-lg space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {comment.isAnonymous
                              ? 'Anonymous'
                              : comment.author.toString().substring(0, 8) + '...'}
                          </span>
                          <span>•</span>
                          <span>{new Date(Number(comment.timestamp) / 1000000).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <AlertDialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report Story</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for reporting this story. Our moderators will review it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for reporting..."
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            rows={4}
            maxLength={500}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReportReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReport}
              disabled={!reportReason.trim() || reportMutation.isPending}
            >
              {reportMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reporting...
                </>
              ) : (
                'Submit Report'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Story</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this story? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={removeMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Story'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
