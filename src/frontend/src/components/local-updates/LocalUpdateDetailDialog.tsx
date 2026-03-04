import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Clock,
  Eye,
  Loader2,
  MapPin,
  Radio,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { useEffect } from "react";
import { useState } from "react";
import type { LocalUpdatePublic } from "../../backend";
import { useInternetIdentity } from "../../hooks/useInternetIdentity";
import {
  useRemoveLocalUpdate,
  useThumbsUpLocalUpdate,
} from "../../hooks/useLocalUpdates";
import { useIsCallerAdmin } from "../../hooks/useQueries";
import {
  computeRelevance,
  formatRadius,
  getLocalCategoryColor,
  getLocalCategoryLabel,
} from "../../lib/localUpdates";
import { formatDistanceValue } from "../../lib/utils";

// Extended type to include viewCount (backend updated but interface not yet regenerated)
type LocalUpdateWithViews = LocalUpdatePublic & { viewCount?: bigint };

interface LocalUpdateDetailDialogProps {
  update: LocalUpdatePublic | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userLocation: { latitude: number; longitude: number } | null;
}

export default function LocalUpdateDetailDialog({
  update,
  open,
  onOpenChange,
  userLocation,
}: LocalUpdateDetailDialogProps) {
  const { identity } = useInternetIdentity();
  const { data: isAdmin } = useIsCallerAdmin();
  const removeUpdateMutation = useRemoveLocalUpdate();
  const thumbsUpMutation = useThumbsUpLocalUpdate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!update) return null;

  const updateWithViews = update as LocalUpdateWithViews;
  const relevance = computeRelevance(update, userLocation);
  const timestamp = new Date(Number(update.timestamp) / 1000000);
  const isAuthor =
    identity?.getPrincipal().toString() === update.author.toString();
  const canDelete = isAuthor || isAdmin;
  const viewCount =
    updateWithViews.viewCount !== undefined
      ? Number(updateWithViews.viewCount)
      : 0;
  const thumbsUpCount = Number(update.thumbsUp);

  const handleDelete = async () => {
    try {
      await removeUpdateMutation.mutateAsync(update.id);
      setShowDeleteConfirm(false);
      onOpenChange(false);
    } catch (_error) {
      // Error handled by mutation
    }
  };

  const handleThumbsUp = () => {
    thumbsUpMutation.mutate(update.id);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Local Update Details</DialogTitle>
            <DialogDescription>
              Posted {timestamp.toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {update.image && (
              <div className="rounded-lg border overflow-hidden">
                <img
                  src={update.image.getDirectURL()}
                  alt="Local update"
                  className="w-full h-auto block"
                />
              </div>
            )}

            <div>
              <p className="text-base font-medium mb-3">{update.content}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="secondary"
                  className={getLocalCategoryColor(update.category)}
                >
                  {getLocalCategoryLabel(update.category)}
                </Badge>
                {relevance.isRelevant && (
                  <Badge
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Radio className="h-3 w-3 mr-1" />
                    You are within range
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Views:</span>
                <span className="font-medium">{viewCount}</span>
              </div>

              <div className="flex items-center gap-2">
                <ThumbsUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Thumbs up:</span>
                <span className="font-medium">{thumbsUpCount}</span>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Radius:</span>
                <span className="font-medium">
                  {formatRadius(Number(update.radius))}
                </span>
              </div>

              {relevance.distanceKm !== null && (
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Distance:</span>
                  <span className="font-medium">
                    {formatDistanceValue(relevance.distanceKm)} away
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Posted:</span>
                <span className="font-medium">
                  {timestamp.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                onClick={handleThumbsUp}
                disabled={thumbsUpMutation.isPending}
                className="w-full"
              >
                {thumbsUpMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Giving thumbs up...
                  </>
                ) : (
                  <>
                    <ThumbsUp className="h-4 w-4 mr-2" />
                    Thumbs up ({thumbsUpCount})
                  </>
                )}
              </Button>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {canDelete && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={removeUpdateMutation.isPending}
                className="sm:mr-auto"
              >
                {removeUpdateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Local Update?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this
              local update.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
