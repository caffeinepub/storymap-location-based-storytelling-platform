import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { useWallpaper } from '../hooks/useWallpaper';
import {
  validateWallpaperFile,
  getMaxFileSizeLabel,
  getAllowedTypesLabel,
} from '../lib/wallpaperValidation';

interface WallpaperSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WallpaperSettingsDialog({
  open,
  onOpenChange,
}: WallpaperSettingsDialogProps) {
  const { wallpaper, applyWallpaper, removeWallpaper } = useWallpaper();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = validateWallpaperFile(file);
    if (!validation.ok) {
      toast.error('Invalid file', {
        description: validation.error.message,
      });
      return;
    }

    // Create preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setSelectedFile(file);
  };

  const handleApply = async () => {
    if (!selectedFile) {
      toast.error('No file selected', {
        description: 'Please select an image file first',
      });
      return;
    }

    setIsApplying(true);
    try {
      await applyWallpaper(selectedFile);
      toast.success('Wallpaper applied', {
        description: 'Your wallpaper has been updated',
      });

      // Clean up preview
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      setSelectedFile(null);

      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to apply wallpaper', {
        description: 'Please try again with a different image',
      });
    } finally {
      setIsApplying(false);
    }
  };

  const handleRemove = () => {
    removeWallpaper();
    toast.success('Wallpaper removed', {
      description: 'Your wallpaper has been cleared',
    });

    // Clean up preview
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);

    onOpenChange(false);
  };

  const handleCancel = () => {
    // Clean up preview
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);

    onOpenChange(false);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const displayUrl = previewUrl || wallpaper.url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wallpaper Settings</DialogTitle>
          <DialogDescription>
            Choose a background image for your app. Max {getMaxFileSizeLabel()}, supported formats: {getAllowedTypesLabel()}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="wallpaper-file">Select Image</Label>
            <input
              ref={fileInputRef}
              id="wallpaper-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleBrowseClick}
              className="w-full"
              disabled={isApplying}
            >
              <Upload className="h-4 w-4 mr-2" />
              Browse Files
            </Button>
          </div>

          {displayUrl && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                <img
                  src={displayUrl}
                  alt="Wallpaper preview"
                  className="h-full w-full object-cover"
                />
              </div>
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedFile.name}
                </p>
              )}
              {!selectedFile && wallpaper.fileName && (
                <p className="text-sm text-muted-foreground">
                  Current: {wallpaper.fileName}
                </p>
              )}
            </div>
          )}

          {!displayUrl && (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
              <p className="text-sm">No wallpaper selected</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {wallpaper.url && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleRemove}
              className="w-full sm:w-auto"
              disabled={isApplying}
            >
              <X className="h-4 w-4 mr-2" />
              Remove
            </Button>
          )}
          <div className="flex gap-2 flex-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="flex-1"
              disabled={isApplying}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleApply}
              disabled={!selectedFile || isApplying}
              className="flex-1"
            >
              {isApplying ? 'Applying...' : 'Apply'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WallpaperSettingsDialog;
