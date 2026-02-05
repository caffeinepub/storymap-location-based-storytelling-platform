import { useState, useEffect } from 'react';
import { useCreateStory } from '../hooks/useQueries';
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
import { Info, MapPin, Upload, X, Navigation, Loader2 } from 'lucide-react';
import { Category, ExternalBlob } from '../backend';
import { getCategoryLabel } from '../lib/categories';
import { toast } from 'sonner';

interface CreateStoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userLocation: { latitude: number; longitude: number } | null;
}

const categories: Category[] = [Category.love, Category.confession, Category.funny, Category.random, Category.other];

type LocationState = 'idle' | 'requesting' | 'granted' | 'denied';

export default function CreateStoryDialog({ open, onOpenChange, userLocation: initialUserLocation }: CreateStoryDialogProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<Category>(Category.other);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(initialUserLocation);
  const [manualLatitude, setManualLatitude] = useState('');
  const [manualLongitude, setManualLongitude] = useState('');
  const [useManualLocation, setUseManualLocation] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const createMutation = useCreateStory();
  const { actor, isFetching: actorFetching } = useActor();
  const { identity, loginStatus, isInitializing } = useInternetIdentity();

  useEffect(() => {
    if (initialUserLocation) {
      setUserLocation(initialUserLocation);
      setLocationState('granted');
    }
  }, [initialUserLocation]);

  const requestLocation = () => {
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation is not supported by your browser');
      setLocationState('denied');
      return;
    }

    setLocationState('requesting');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation(location);
        setLocationState('granted');
        setUseManualLocation(false);
        toast.success('Location access granted');
      },
      (error) => {
        console.error('Geolocation error:', error);
        setLocationState('denied');
        if (error.code === error.PERMISSION_DENIED) {
          toast.error('Location access denied. Please enter coordinates manually or enable location permissions in your browser settings.');
        } else if (error.code === error.TIMEOUT) {
          toast.error('Location request timed out. Please try again or enter coordinates manually.');
        } else {
          toast.error('Failed to get location. Please enter coordinates manually.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
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
    setLocationState('granted');
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

    let imageBlob: ExternalBlob | null = null;
    if (imageFile) {
      try {
        const arrayBuffer = await imageFile.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        imageBlob = ExternalBlob.fromBytes(uint8Array).withUploadProgress((percentage) => {
          setUploadProgress(percentage);
        });
      } catch (error) {
        toast.error('Failed to process image');
        return;
      }
    }

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
          setTitle('');
          setContent('');
          setCategory(Category.other);
          setIsAnonymous(false);
          removeImage();
          setUploadProgress(0);
          setManualLatitude('');
          setManualLongitude('');
          setUseManualLocation(false);
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
  const isRequestingLocation = locationState === 'requesting';

  const showLoginRequired = !isAuthenticating && !isAuthenticated;
  const showActorLoading = isAuthenticated && isActorInitializing;

  const formEnabled = isAuthenticated && isActorReady;
  const canSubmit = formEnabled && !!userLocation && title.trim() && content.trim() && !createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
              Please log in to post a story.
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

        {locationState === 'idle' && !userLocation && (
          <Alert>
            <MapPin className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <div className="flex items-center justify-between">
                <span>Location is required to post a story.</span>
                <Button
                  variant="default"
                  size="sm"
                  onClick={requestLocation}
                  disabled={isRequestingLocation}
                  className="ml-2"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Allow Location Access
                </Button>
              </div>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 mt-2"
                onClick={() => setUseManualLocation(true)}
              >
                Or enter coordinates manually
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {locationState === 'requesting' && (
          <Alert>
            <MapPin className="h-4 w-4 animate-pulse" />
            <AlertDescription className="text-sm">
              Requesting location access... Please allow location permissions in your browser.
            </AlertDescription>
          </Alert>
        )}

        {locationState === 'denied' && !userLocation && (
          <Alert variant="destructive">
            <MapPin className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <div className="space-y-2">
                <p>Location access was denied. You can:</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={requestLocation}
                    disabled={isRequestingLocation}
                  >
                    {isRequestingLocation ? 'Requesting...' : 'Retry Location Access'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUseManualLocation(true)}
                  >
                    Enter Manually
                  </Button>
                </div>
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
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleManualLocationSubmit}
                disabled={!manualLatitude || !manualLongitude}
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
                    setLocationState('idle');
                    setUseManualLocation(false);
                  }}
                >
                  Change
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Give your story a title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              required
              disabled={!formEnabled}
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
              disabled={!formEnabled}
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
              disabled={!formEnabled}
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

          <div className="space-y-2">
            <Label htmlFor="image">Image (Optional)</Label>
            {!imagePreview ? (
              <div className="flex items-center gap-2">
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="cursor-pointer"
                  disabled={!formEnabled}
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
                  className="absolute top-2 right-2"
                  onClick={removeImage}
                  disabled={!formEnabled}
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
              disabled={!formEnabled}
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

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
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
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
