import { FileText, Image as ImageIcon, Loader2, MapPin, X } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Category, type StoryDraft } from "../backend";
import { ExternalBlob } from "../backend";
import {
  useCreateDraft,
  useDeleteDraft,
  useListDrafts,
  usePublishDraft,
  useUpdateDraft,
} from "../hooks/useDrafts";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useCreateStory } from "../hooks/useQueries";
import LocationPickerDialog from "./LocationPickerDialog";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";

// Internal shape using { lat, lng } for convenience
interface PickedLocation {
  lat: number;
  lng: number;
}

interface CreateStoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDraftId?: string;
}

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: Category.love, label: "Love" },
  { value: Category.confession, label: "Confession" },
  { value: Category.funny, label: "Funny" },
  { value: Category.random, label: "Random" },
  { value: Category.other, label: "Other" },
];

export default function CreateStoryDialog({
  open,
  onOpenChange,
  initialDraftId,
}: CreateStoryDialogProps) {
  const { identity } = useInternetIdentity();
  const isAuthenticated = !!identity;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<Category>(Category.random);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [locationName, setLocationName] = useState("");
  // pickedLocation holds the map-picker coordinates — these are the story's lat/lng.
  // The user's live device geolocation is NEVER used as the story's coordinates.
  const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(
    null,
  );
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(
    initialDraftId ?? null,
  );
  const [showDraftList, setShowDraftList] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const createStory = useCreateStory();
  const createDraft = useCreateDraft();
  const updateDraft = useUpdateDraft();
  const deleteDraft = useDeleteDraft();
  const publishDraft = usePublishDraft();
  const { data: drafts = [] } = useListDrafts();

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTitle("");
      setContent("");
      setCategory(Category.random);
      setIsAnonymous(false);
      setLocationName("");
      setPickedLocation(null);
      setImageFile(null);
      setImagePreviewUrl(null);
      setActiveDraftId(initialDraftId ?? null);
      setShowDraftList(false);
    }
  }, [open, initialDraftId]);

  // Load draft data when initialDraftId changes or dialog opens
  useEffect(() => {
    if (open && initialDraftId && drafts.length > 0) {
      const draft = drafts.find((d) => d.id === initialDraftId);
      if (draft) {
        loadDraftIntoForm(draft);
      }
    }
  }, [open, initialDraftId, drafts]);

  function loadDraftIntoForm(draft: StoryDraft) {
    setTitle(draft.title);
    setContent(draft.content);
    setCategory(draft.category);
    setIsAnonymous(draft.isAnonymous);
    setLocationName(draft.locationName ?? "");
    setActiveDraftId(draft.id);

    // Load draft's map-picker coordinates (draft.latitude / draft.longitude)
    // These are the story's pinned coordinates, not device geolocation
    if (draft.latitude != null && draft.longitude != null) {
      setPickedLocation({ lat: draft.latitude, lng: draft.longitude });
    } else {
      setPickedLocation(null);
    }

    if (draft.image) {
      setImagePreviewUrl(draft.image.getDirectURL());
    }
  }

  async function buildImageBlob(): Promise<ExternalBlob | null> {
    if (!imageFile) return null;
    const arrayBuffer = await imageFile.arrayBuffer();
    return ExternalBlob.fromBytes(new Uint8Array(arrayBuffer));
  }

  async function handleSubmit() {
    if (!isAuthenticated) {
      toast.error("Please log in to post a story.");
      return;
    }

    // Require a map-picked location — device geolocation is NOT used as story coordinates
    if (!pickedLocation) {
      toast.error("Please pick a location on the map before posting.");
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter a title.");
      return;
    }

    if (!content.trim()) {
      toast.error("Please enter some content.");
      return;
    }

    setIsSubmitting(true);
    try {
      const imageBlob = await buildImageBlob();

      if (activeDraftId) {
        // Publish from draft — uses draft's map-picker coordinates
        await publishDraft.mutateAsync(activeDraftId);
      } else {
        // Create story directly — uses pickedLocation (map-picker coordinates only)
        await createStory.mutateAsync({
          title: title.trim(),
          content: content.trim(),
          category,
          locationName: locationName.trim() || null,
          latitude: pickedLocation.lat,
          longitude: pickedLocation.lng,
          isAnonymous,
          image: imageBlob,
        });
      }

      toast.success("Story posted!");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to post story.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveDraft() {
    if (!isAuthenticated) {
      toast.error("Please log in to save a draft.");
      return;
    }

    setIsSavingDraft(true);
    try {
      const imageBlob = await buildImageBlob();

      if (activeDraftId) {
        await updateDraft.mutateAsync({
          draftId: activeDraftId,
          title: title.trim(),
          content: content.trim(),
          category,
          locationName: locationName.trim() || null,
          latitude: pickedLocation?.lat ?? null,
          longitude: pickedLocation?.lng ?? null,
          isAnonymous,
          image: imageBlob,
        });
        toast.success("Draft updated.");
      } else {
        const newDraftId = await createDraft.mutateAsync({
          title: title.trim(),
          content: content.trim(),
          category,
          locationName: locationName.trim() || null,
          latitude: pickedLocation?.lat ?? null,
          longitude: pickedLocation?.lng ?? null,
          isAnonymous,
          image: imageBlob,
        });
        setActiveDraftId(newDraftId);
        toast.success("Draft saved.");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save draft.");
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function handleDeleteDraft() {
    if (!activeDraftId) return;
    try {
      await deleteDraft.mutateAsync(activeDraftId);
      setActiveDraftId(null);
      setTitle("");
      setContent("");
      setCategory(Category.random);
      setIsAnonymous(false);
      setLocationName("");
      setPickedLocation(null);
      setImageFile(null);
      setImagePreviewUrl(null);
      toast.success("Draft deleted.");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete draft.");
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
  }

  function handleRemoveImage() {
    setImageFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Convert internal { lat, lng } to { latitude, longitude } for LocationPickerDialog
  const pickedLocationForPicker = pickedLocation
    ? { latitude: pickedLocation.lat, longitude: pickedLocation.lng }
    : undefined;

  const canSubmit =
    isAuthenticated &&
    title.trim().length > 0 &&
    content.trim().length > 0 &&
    !isSubmitting;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {activeDraftId ? "Edit Draft" : "Share a Story"}
            </DialogTitle>
            <DialogDescription>
              Pin your story to a location on the map.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 mt-2">
            {/* Draft list toggle */}
            {isAuthenticated && drafts.length > 0 && (
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowDraftList((v) => !v)}
                >
                  <FileText className="w-3.5 h-3.5" />
                  {showDraftList ? "Hide Drafts" : `Drafts (${drafts.length})`}
                </Button>

                {showDraftList && (
                  <div className="mt-2 border border-border rounded-lg divide-y divide-border">
                    {drafts.map((draft) => (
                      <button
                        type="button"
                        key={draft.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                        onClick={() => {
                          loadDraftIntoForm(draft);
                          setShowDraftList(false);
                        }}
                      >
                        <span className="font-medium">
                          {draft.title || "(Untitled)"}
                        </span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          {draft.category}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="story-title">Title</Label>
              <Input
                id="story-title"
                placeholder="Give your story a title…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </div>

            {/* Content */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="story-content">Story</Label>
              <Textarea
                id="story-content"
                placeholder="Tell your story…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                maxLength={2000}
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as Category)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location picker — map-picker coordinates are the story's lat/lng */}
            <div className="flex flex-col gap-1.5">
              <Label>Location (optional)</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={pickedLocation ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setIsLocationPickerOpen(true)}
                  data-ocid="story.location.button"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {pickedLocation
                    ? `${pickedLocation.lat.toFixed(4)}, ${pickedLocation.lng.toFixed(4)}`
                    : "Pick on Map"}
                </Button>
                {pickedLocation && (
                  <button
                    type="button"
                    onClick={() => setPickedLocation(null)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Clear location"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Pick a location on the map to pin your story (recommended).
              </p>
            </div>

            {/* Location name */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="location-name">Location Name (optional)</Label>
              <Input
                id="location-name"
                placeholder="e.g. Central Park, Mumbai…"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                maxLength={80}
              />
            </div>

            {/* Image upload */}
            <div className="flex flex-col gap-1.5">
              <Label>Image (optional)</Label>
              {imagePreviewUrl ? (
                <div className="relative">
                  <img
                    src={imagePreviewUrl}
                    alt="Preview"
                    className="w-full h-auto block rounded-lg max-h-48 object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 bg-background/80 rounded-full p-1 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    aria-label="Remove image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 border border-dashed border-border rounded-lg px-4 py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  data-ocid="story.upload_button"
                >
                  <ImageIcon className="w-4 h-4" />
                  Add an image
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>

            {/* Anonymous toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-muted-foreground">
                Post anonymously
              </span>
            </label>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2">
              {isAuthenticated && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveDraft}
                    disabled={isSavingDraft}
                    className="gap-1.5"
                  >
                    {isSavingDraft && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    {activeDraftId ? "Update Draft" : "Save Draft"}
                  </Button>

                  {activeDraftId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDeleteDraft}
                      className="text-destructive hover:text-destructive"
                    >
                      Delete Draft
                    </Button>
                  )}
                </>
              )}

              <Button
                className="ml-auto gap-1.5"
                onClick={handleSubmit}
                disabled={!canSubmit}
                data-ocid="story.submit_button"
              >
                {isSubmitting && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Post Story
              </Button>
            </div>

            {!isAuthenticated && (
              <p className="text-xs text-muted-foreground text-center">
                Please log in to post or save stories.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Location picker dialog — uses { latitude, longitude } shape */}
      <LocationPickerDialog
        open={isLocationPickerOpen}
        onOpenChange={setIsLocationPickerOpen}
        initialLocation={pickedLocationForPicker}
        onConfirm={(loc) => {
          setPickedLocation({ lat: loc.latitude, lng: loc.longitude });
          setIsLocationPickerOpen(false);
        }}
        onCancel={() => setIsLocationPickerOpen(false)}
      />
    </>
  );
}
