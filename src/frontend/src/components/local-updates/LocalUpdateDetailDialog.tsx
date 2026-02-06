import type { LocalUpdate } from '../../backend';
import { computeRelevance, getLocalCategoryLabel, getLocalCategoryColor, formatRadius } from '../../lib/localUpdates';
import { formatDistanceValue } from '../../lib/utils';
import { useRemoveLocalUpdate } from '../../hooks/useLocalUpdates';
import { useInternetIdentity } from '../../hooks/useInternetIdentity';
import { useIsCallerAdmin } from '../../hooks/useQueries';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Radio, Trash2, Loader2 } from 'lucide-react';
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
import { useState } from 'react';

interface LocalUpdateDetailDialogProps {
  update: LocalUpdate | null;
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!update) return null;

  const relevance = computeRelevance(update, userLocation);
  const timestamp = new Date(Number(update.timestamp) / 1000000);
  const isAuthor = identity?.getPrincipal().toString() === update.author.toString();
  const canDelete = isAuthor || isAdmin;

  const handleDelete = async () => {
    try {
      await removeUpdateMutation.mutateAsync(update.id);
      setShowDeleteConfirm(false);
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
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
                  className="w-full h-64 object-cover"
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
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                    <Radio className="h-3 w-3 mr-1" />
                    You are within range
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Radius:</span>
                <span className="font-medium">{formatRadius(Number(update.radius))}</span>
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
                <span className="font-medium">{timestamp.toLocaleString()}</span>
              </div>
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
              This action cannot be undone. This will permanently delete this local update.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
