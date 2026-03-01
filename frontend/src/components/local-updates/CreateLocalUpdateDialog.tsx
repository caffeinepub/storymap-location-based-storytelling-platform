import { useState } from 'react';
import { useAddLocalUpdate } from '../../hooks/useLocalUpdates';
import { LocalCategory, ExternalBlob } from '../../backend';
import { getLocalCategoryLabel } from '../../lib/localUpdates';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

interface CreateLocalUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userLocation: { latitude: number; longitude: number } | null;
  permissionState: string;
}

const categories = [
  LocalCategory.traffic,
  LocalCategory.power,
  LocalCategory.police,
  LocalCategory.event,
  LocalCategory.nature,
  LocalCategory.general,
];

export default function CreateLocalUpdateDialog({
  open,
  onOpenChange,
  userLocation,
  permissionState,
}: CreateLocalUpdateDialogProps) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<LocalCategory>(LocalCategory.general);
  const [radius, setRadius] = useState(500);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const addLocalUpdateMutation = useAddLocalUpdate();

  const canPost = !!userLocation && content.trim().length > 0;
  const showLocationWarning = !userLocation;

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
  };

  const handleSubmit = async () => {
    if (!canPost) return;

    try {
      // Process image if selected
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

      await addLocalUpdateMutation.mutateAsync({
        content: content.trim(),
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        radius,
        category,
        image: imageBlob,
      });

      // Reset form
      setContent('');
      setCategory(LocalCategory.general);
      setRadius(500);
      removeImage();
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const getLocationWarningMessage = () => {
    if (permissionState === 'denied') {
      return 'Location access is denied. Please enable location permissions in your browser settings to post local updates.';
    }
    if (permissionState === 'insecure') {
      return 'Location is not available on insecure connections. Please use HTTPS to post local updates.';
    }
    if (permissionState === 'unsupported') {
      return 'Your browser does not support geolocation. Local updates require location access.';
    }
    return 'Location is required to post local updates. Please enable location access.';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Post Local Update</DialogTitle>
          <DialogDescription>
            Share a short update about what's happening near you right now.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {showLocationWarning && (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {getLocationWarningMessage()}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="content">Update Content</Label>
            <Textarea
              id="content"
              placeholder="What's happening near you?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              maxLength={200}
              disabled={!userLocation}
            />
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Examples:</span>
                <ul className="mt-1 space-y-0.5 list-none">
                  <li>"There's road work near the metro"</li>
                  <li>"This café just opened"</li>
                  <li>"Power cut in this area"</li>
                  <li>"Police checking vehicles today"</li>
                  <li>"Beautiful sunset near the lake"</li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground whitespace-nowrap">
                {content.length}/200
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as LocalCategory)}
              disabled={!userLocation}
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {getLocalCategoryLabel(cat)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="radius">
              Relevance Radius: {radius}m
            </Label>
            <Slider
              id="radius"
              min={200}
              max={1000}
              step={50}
              value={[radius]}
              onValueChange={(values) => setRadius(values[0])}
              disabled={!userLocation}
            />
            <p className="text-xs text-muted-foreground">
              Users within this radius will be notified when they're nearby.
            </p>
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
                  disabled={!userLocation}
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
                  disabled={!userLocation}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Maximum file size: 5MB. Supported formats: JPG, PNG, GIF, WebP
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canPost || addLocalUpdateMutation.isPending}
          >
            {addLocalUpdateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Posting...
              </>
            ) : (
              'Post Update'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
