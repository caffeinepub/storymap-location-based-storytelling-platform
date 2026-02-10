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
import { Info, MapPin, Upload, X, Navigation, Loader2, Save, FileText, Trash2, Map, AlertCircle } from 'lucide-react';
import { Category, ExternalBlob } from '../backend';
import { getCategoryLabel } from '../lib/categories';
import { toast } from 'sonner';
import { getLocationCopy } from '../lib/locationPermissionCopy';
import type { PermissionState, GeolocationDiagnostics } from '../hooks/useGeolocationPermission';
import type { StoryDraft } from '../backend';
import LocationPickerDialog from './LocationPickerDialog';

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
  const [showLocationPicker, setShowLocationPicker] = useState(false);

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

  const handleOpenLocationPicker = () => {
    setShowLocationPicker(true);
  };

  const handleLocationPickerConfirm = (location: { latitude: number; longitude: number }) => {
    setUserLocation(location);
    setShowLocationPicker(false);
    toast.success('Location set from map');
  };

  const handleLocationPickerCancel = () => {
    setShowLocationPicker(false);
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
  const showLocationDenied = !userLocation && permissionState === 'denied';
  const showLocationUnsupported = !userLocation && permissionState === 'unsupported';
  const showLocationInsecure = !userLocation && permissionState === 'insecure';

  return (
    <>
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
              <AlertDescription className="text-sm flex items-center justify-between">
                <span>Editing draft</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteDraft}
                  disabled={deleteDraftMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete Draft
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Give your story a title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                disabled={!isAuthenticated}
              />
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="content">Your Story</Label>
              <Textarea
                id="content"
                placeholder="Share your story..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                maxLength={2000}
                disabled={!isAuthenticated}
              />
              <p className="text-xs text-muted-foreground text-right">
                {content.length}/2000 characters
              </p>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as Category)}
                disabled={!isAuthenticated}
              >
                <SelectTrigger id="category">
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

            {/* Image Upload */}
            <div className="space-y-2">
              <Label htmlFor="image">Image (Optional)</Label>
              {!imagePreview ? (
                <div className="flex items-center gap-2">
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={!isAuthenticated}
                    className="flex-1"
                  />
                  <Upload className="h-4 w-4 text-muted-foreground" />
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={removeImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {isUploading && (
                <div className="space-y-1">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Location Section */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location (Required)
              </Label>

              {userLocation ? (
                <Alert>
                  <MapPin className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-sm">
                    Location set: {userLocation.latitude.toFixed(6)}, {userLocation.longitude.toFixed(6)}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {locationCopy.description}
                  </AlertDescription>
                </Alert>
              )}

              {/* Primary: Map Picker */}
              <Button
                type="button"
                variant="default"
                className="w-full"
                onClick={handleOpenLocationPicker}
                disabled={!isAuthenticated}
              >
                <Map className="h-4 w-4 mr-2" />
                {userLocation ? 'Change Location on Map' : 'Pick Location on Map'}
              </Button>

              {/* Secondary: Browser Geolocation */}
              {!userLocation && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleRequestLocation}
                    disabled={!isAuthenticated || isRequestingLocation || permissionState === 'denied'}
                  >
                    {isRequestingLocation ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Getting location...
                      </>
                    ) : (
                      <>
                        <Navigation className="h-4 w-4 mr-2" />
                        Use My Current Location
                      </>
                    )}
                  </Button>

                  {(showLocationDenied || showLocationUnsupported || showLocationInsecure) && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {locationCopy.description}
                        {diagnostics?.userFriendlyDetail && (
                          <div className="mt-1 text-xs opacity-75">
                            {diagnostics.userFriendlyDetail}
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}

              {/* Fallback: Manual Entry */}
              {!userLocation && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or enter manually</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="latitude" className="text-xs">Latitude</Label>
                      <Input
                        id="latitude"
                        type="number"
                        step="any"
                        placeholder="e.g., 40.7128"
                        value={manualLatitude}
                        onChange={(e) => setManualLatitude(e.target.value)}
                        disabled={!isAuthenticated}
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
                        disabled={!isAuthenticated}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleManualLocationSubmit}
                    disabled={!isAuthenticated || !manualLatitude || !manualLongitude}
                  >
                    Set Manual Location
                  </Button>
                </>
              )}
            </div>

            <Separator />

            {/* Anonymous Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="anonymous">Post Anonymously</Label>
                <p className="text-xs text-muted-foreground">
                  Your identity will be hidden from other users
                </p>
              </div>
              <Switch
                id="anonymous"
                checked={isAnonymous}
                onCheckedChange={setIsAnonymous}
                disabled={!isAuthenticated}
              />
            </div>

            {/* Guidelines */}
            {showGuidelines && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs space-y-1">
                  <p className="font-medium">Community Guidelines:</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    <li>Be respectful and kind</li>
                    <li>No hate speech or harassment</li>
                    <li>Keep content appropriate for all ages</li>
                    <li>Respect others' privacy</li>
                  </ul>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowGuidelines(false)}
                    className="mt-2"
                  >
                    Got it
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              {canDraft && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={!canSaveDraft}
                  className="flex-1"
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
              )}
              {selectedDraftId ? (
                <Button
                  type="button"
                  onClick={handlePublishDraft}
                  disabled={!canPublish}
                  className="flex-1"
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
              ) : (
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="flex-1"
                >
                  {createMutation.isPending ? (
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

      {/* Location Picker Dialog */}
      <LocationPickerDialog
        open={showLocationPicker}
        onOpenChange={setShowLocationPicker}
        initialLocation={userLocation}
        onConfirm={handleLocationPickerConfirm}
        onCancel={handleLocationPickerCancel}
      />
    </>
  );
}
