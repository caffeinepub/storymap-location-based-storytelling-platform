import { useState, useEffect } from 'react';
import { useCreateStory } from '../hooks/useQueries';
import { useSaveDraft, useListDrafts, useDeleteDraft, usePublishDraft } from '../hooks/useDrafts';
import { useActor } from '../hooks/useActor';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Info, MapPin, Upload, X, Navigation, Loader2, Save, FileText, Trash2 } from 'lucide-react';
import { Category, ExternalBlob } from '../backend';
import { getCategoryLabel } from '../lib/categories';
import { toast } from 'sonner';
import { getLocationCopy } from '../lib/locationPermissionCopy';
import type { PermissionState, GeolocationDiagnostics } from '../hooks/useGeolocationPermission';
import type { StoryDraft } from '../backend';

interface CreateStoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userLocation: { latitude: number; longitude: number } | null;
  permissionState: PermissionState;
  onRequestLocation: () => Promise<void>;
  diagnostics: GeolocationDiagnostics | null;
}

const categories: Category[] = [Category.love, Category.confession, Category.funny, Category.random, Category.other];

export default function CreateStoryDialog({ 
  open, 
  onOpenChange, 
  userLocation: initialUserLocation,
  permissionState,
  onRequestLocation,
  diagnostics,
}: CreateStoryDialogProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<Category>(Category.other);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(initialUserLocation);
  const [manualLatitude, setManualLatitude] = useState('');
  const [manualLongitude, setManualLongitude] = useState('');
  const [useManualLocation, setUseManualLocation] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [showDraftsList, setShowDraftsList] = useState(false);

  const createMutation = useCreateStory();
  const saveDraftMutation = useSaveDraft();
  const deleteDraftMutation = useDeleteDraft();
  const publishDraftMutation = usePublishDraft();
  const { data: drafts = [], isLoading: draftsLoading } = useListDrafts();
  const { actor, isFetching: actorFetching } = useActor();
  const { identity, loginStatus, isInitializing } = useInternetIdentity();

  useEffect(() => {
    if (initialUserLocation) {
      setUserLocation(initialUserLocation);
    }
  }, [initialUserLocation]);

  const handleRequestLocation = async () => {
    setIsRequestingLocation(true);
    try {
      await onRequestLocation();
    } catch (error) {
      // Error already handled by parent
    } finally {
      setIsRequestingLocation(false);
    }
  };

  const handleManualLocationSubmit = () => {
    const lat = parseFloat(manualLatitude);
    const lng = parseFloat(manualLongitude);

    if (isNaN(lat) || isNaN(lng)) {
      toast.error('Please enter valid coordinates');
      return;
    }

    if (lat < -90 || lat > 90) {
      toast.error('Latitude must be between -90 and 90');
      return;
    }

    if (lng < -180 || lng > 180) {
      toast.error('Longitude must be between -180 and 180');
      return;
    }

    setUserLocation({ latitude: lat, longitude: lng });
    toast.success('Manual location set');
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setUploadProgress(0);
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setCategory(Category.other);
    setIsAnonymous(false);
    removeImage();
    setUploadProgress(0);
    setManualLatitude('');
    setManualLongitude('');
    setUseManualLocation(false);
    setSelectedDraftId(null);
    setShowDraftsList(false);
  };

  const loadDraft = async (draft: StoryDraft) => {
    setTitle(draft.title);
    setContent(draft.content);
    setCategory(draft.category);
    setIsAnonymous(draft.isAnonymous);
    setSelectedDraftId(draft.id);
    setShowDraftsList(false);

    // Load location if present
    if (draft.location) {
      setUserLocation(draft.location);
      setUseManualLocation(true);
    }

    // Load image if present
    if (draft.image) {
      try {
        const imageUrl = draft.image.getDirectURL();
        setImagePreview(imageUrl);
        // Note: We keep the ExternalBlob reference for re-saving
      } catch (error) {
        console.error('Failed to load draft image:', error);
      }
    }

    toast.success('Draft loaded');
  };

  const handleSaveDraft = async () => {
    if (!identity) {
      toast.error('Please log in to save drafts');
      return;
    }

    if (!title.trim() || !content.trim()) {
      toast.error('Title and content are required to save a draft');
      return;
    }

    // Process image if new file selected
    let imageBlob: ExternalBlob | null = null;
    if (imageFile) {
      try {
        const arrayBuffer = await imageFile.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        imageBlob = ExternalBlob.fromBytes(uint8Array);
      } catch (error) {
        console.error('Failed to process image:', error);
        toast.error('Failed to process image');
        return;
      }
    }

    saveDraftMutation.mutate({
      draftId: selectedDraftId || undefined,
      title: title.trim(),
      content: content.trim(),
      category,
      location: userLocation,
      isAnonymous,
      image: imageBlob,
    });
  };

  const handleDeleteDraft = () => {
    if (!selectedDraftId) return;

    if (confirm('Are you sure you want to delete this draft?')) {
      deleteDraftMutation.mutate(selectedDraftId, {
        onSuccess: () => {
          resetForm();
        },
      });
    }
  };

  const handlePublishDraft = () => {
    if (!selectedDraftId) return;

    if (!userLocation) {
      toast.error('Please add a location before publishing');
      return;
    }

    publishDraftMutation.mutate(selectedDraftId, {
      onSuccess: () => {
        resetForm();
        onOpenChange(false);
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!identity) {
      toast.error('Please log in to post a story');
      return;
    }

    if (!userLocation) {
      toast.error('Location is required to post a story');
      return;
    }

    // Image is optional - only process if file exists
    let imageBlob: ExternalBlob | null = null;
    if (imageFile) {
      try {
        const arrayBuffer = await imageFile.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        imageBlob = ExternalBlob.fromBytes(uint8Array).withUploadProgress((percentage) => {
          setUploadProgress(percentage);
        });
      } catch (error) {
        console.error('Failed to process image:', error);
        toast.error('Failed to process image');
        return;
      }
    }

    // Submit with or without image
    createMutation.mutate(
      {
        title: title.trim(),
        content: content.trim(),
        category,
        location: userLocation,
        isAnonymous,
        image: imageBlob,
      },
      {
        onSuccess: () => {
          resetForm();
          onOpenChange(false);
        },
      }
    );
  };

  const isAuthenticating = isInitializing || loginStatus === 'logging-in';
  const isAuthenticated = !!identity && !isInitializing;
  const isActorInitializing = actorFetching && !actor;
  const isActorReady = !!actor && !actorFetching;
  const isUploading = createMutation.isPending && uploadProgress > 0 && uploadProgress < 100;

  const showLoginRequired = !isAuthenticating && !isAuthenticated;
  const showActorLoading = isAuthenticated && isActorInitializing;

  const canDraft = isAuthenticated;
  const canSaveDraft = isAuthenticated && isActorReady && title.trim() && content.trim() && !saveDraftMutation.isPending;
  const canSubmit = isAuthenticated && isActorReady && !!userLocation && title.trim() && content.trim() && !createMutation.isPending;
  const canPublish = isAuthenticated && isActorReady && !!selectedDraftId && !!userLocation && !publishDraftMutation.isPending;

  const locationCopy = getLocationCopy(permissionState);
  const showLocationIdle = !userLocation && (permissionState === 'prompt' || permissionState === 'unknown');
  const showLocationDenied = !userLocation && permissionState === 'denied';
  const showLocationUnsupported = !userLocation && permissionState === 'unsupported';
  const showLocationInsecure = !userLocation && permissionState === 'insecure';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        resetForm();
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto pointer-events-auto">
        <DialogHeader>
          <DialogTitle>Share Your Story</DialogTitle>
          <DialogDescription>
            Pin your story to a location and share it with the community.
          </DialogDescription>
        </DialogHeader>

        {showLoginRequired && (
          <Alert variant="destructive">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Please log in to post a story or save drafts.
            </AlertDescription>
          </Alert>
        )}

        {showActorLoading && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription className="text-sm">
              Connecting to backend, please wait...
            </AlertDescription>
          </Alert>
        )}

        {isAuthenticating && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription className="text-sm">
              Authenticating...
            </AlertDescription>
          </Alert>
        )}

        {/* Drafts Section */}
        {isAuthenticated && !showDraftsList && drafts.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                You have {drafts.length} saved draft{drafts.length !== 1 ? 's' : ''}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDraftsList(true)}
            >
              Load Draft
            </Button>
          </div>
        )}

        {showDraftsList && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Your Drafts</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDraftsList(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="h-48 rounded-md border">
              <div className="p-2 space-y-2">
                {draftsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : drafts.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No drafts saved yet
                  </div>
                ) : (
                  drafts.map((draft) => (
                    <div
                      key={draft.id}
                      className="p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => loadDraft(draft)}
                    >
                      <div className="font-medium text-sm truncate">{draft.title}</div>
                      <div className="text-xs text-muted-foreground truncate mt-1">
                        {draft.content.substring(0, 60)}...
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {getCategoryLabel(draft.category)} • Updated {new Date(Number(draft.updatedAt) / 1000000).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {selectedDraftId && (
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <div className="flex items-center justify-between">
                <span>Editing draft</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                >
                  Clear & Start New
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {showGuidelines && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Community Guidelines:</strong> Be respectful, authentic, and mindful of others.
              No hate speech, harassment, or inappropriate content.
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 ml-2"
                onClick={() => setShowGuidelines(false)}
              >
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {showLocationIdle && (
          <Alert>
            <MapPin className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <div className="flex items-center justify-between">
                <span>{locationCopy.description}</span>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleRequestLocation}
                  disabled={isRequestingLocation}
                  className="ml-2"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  {isRequestingLocation ? 'Requesting...' : locationCopy.action}
                </Button>
              </div>
              {locationCopy.secondaryAction && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 mt-2"
                  onClick={() => setUseManualLocation(true)}
                >
                  Or enter coordinates manually
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {permissionState === 'requesting' && !userLocation && (
          <Alert>
            <MapPin className="h-4 w-4 animate-pulse" />
            <AlertDescription className="text-sm">
              {locationCopy.description}
            </AlertDescription>
          </Alert>
        )}

        {showLocationDenied && (
          <Alert variant="destructive">
            <MapPin className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <div className="space-y-2">
                <p className="font-medium">{locationCopy.title}</p>
                <p>{locationCopy.description}</p>
                {diagnostics?.userFriendlyDetail && (
                  <p className="text-xs opacity-75">
                    Details: {diagnostics.userFriendlyDetail}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRequestLocation}
                    disabled={isRequestingLocation}
                  >
                    {isRequestingLocation ? 'Requesting...' : locationCopy.action}
                  </Button>
                  {locationCopy.secondaryAction && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUseManualLocation(true)}
                    >
                      {locationCopy.secondaryAction}
                    </Button>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {showLocationInsecure && (
          <Alert variant="destructive">
            <MapPin className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <div className="space-y-2">
                <p className="font-medium">{locationCopy.title}</p>
                <p>{locationCopy.description}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUseManualLocation(true)}
                >
                  {locationCopy.action}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {showLocationUnsupported && (
          <Alert variant="destructive">
            <MapPin className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <div className="space-y-2">
                <p className="font-medium">{locationCopy.title}</p>
                <p>{locationCopy.description}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUseManualLocation(true)}
                >
                  {locationCopy.action}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {useManualLocation && !userLocation && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <Label className="text-sm font-medium">Manual Location Entry</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="latitude" className="text-xs">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  placeholder="e.g., 40.7128"
                  value={manualLatitude}
                  onChange={(e) => setManualLatitude(e.target.value)}
                  className="pointer-events-auto"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="longitude" className="text-xs">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  placeholder="e.g., -74.0060"
                  value={manualLongitude}
                  onChange={(e) => setManualLongitude(e.target.value)}
                  className="pointer-events-auto"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleManualLocationSubmit}
                disabled={!manualLatitude || !manualLongitude}
                className="pointer-events-auto"
              >
                Set Location
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setUseManualLocation(false);
                  setManualLatitude('');
                  setManualLongitude('');
                }}
                className="pointer-events-auto"
              >
                Cancel
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Latitude: -90 to 90, Longitude: -180 to 180
            </p>
          </div>
        )}

        {userLocation && (
          <Alert>
            <MapPin className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-sm">
              <div className="flex items-center justify-between">
                <span>
                  Location set: {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setUserLocation(null);
                    setUseManualLocation(false);
                  }}
                  className="pointer-events-auto"
                >
                  Change
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pointer-events-auto">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Give your story a title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              required
              disabled={!canDraft}
              className="pointer-events-auto"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Story *</Label>
            <Textarea
              id="content"
              placeholder="Share your story..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              maxLength={2000}
              required
              disabled={!canDraft}
              className="pointer-events-auto"
            />
            <p className="text-xs text-muted-foreground text-right">
              {content.length}/2000 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select 
              value={category} 
              onValueChange={(value) => setCategory(value as Category)}
              disabled={!canDraft}
            >
              <SelectTrigger id="category" className="pointer-events-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="pointer-events-auto">
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat} className="pointer-events-auto">
                    {getCategoryLabel(cat)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Image (Optional)</Label>
            {!imagePreview ? (
              <div className="flex items-center gap-2">
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="cursor-pointer pointer-events-auto"
                  disabled={!canDraft}
                />
                <Upload className="h-4 w-4 text-muted-foreground" />
              </div>
            ) : (
              <div className="relative rounded-lg border overflow-hidden">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-48 object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 pointer-events-auto"
                  onClick={removeImage}
                  disabled={!canDraft}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Maximum file size: 5MB. Supported formats: JPG, PNG, GIF, WebP
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="anonymous">Post Anonymously</Label>
              <p className="text-sm text-muted-foreground">
                Your identity will be hidden from other users
              </p>
            </div>
            <Switch 
              id="anonymous" 
              checked={isAnonymous} 
              onCheckedChange={setIsAnonymous}
              disabled={!canDraft}
              className="pointer-events-auto"
            />
          </div>

          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Uploading image...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <Separator />

          <div className="flex flex-wrap gap-2 justify-end pointer-events-auto">
            {selectedDraftId && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDeleteDraft}
                disabled={deleteDraftMutation.isPending}
                className="pointer-events-auto"
              >
                {deleteDraftMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Draft
                  </>
                )}
              </Button>
            )}
            
            <div className="flex-1" />
            
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              className="pointer-events-auto"
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={handleSaveDraft}
              disabled={!canSaveDraft}
              className="pointer-events-auto"
            >
              {saveDraftMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Draft
                </>
              )}
            </Button>

            {selectedDraftId && (
              <Button
                type="button"
                variant="default"
                onClick={handlePublishDraft}
                disabled={!canPublish}
                className="pointer-events-auto"
              >
                {publishDraftMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  'Publish Draft'
                )}
              </Button>
            )}

            {!selectedDraftId && (
              <Button
                type="submit"
                disabled={!canSubmit}
                className="pointer-events-auto"
              >
                {showActorLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  'Post Story'
                )}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
