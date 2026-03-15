import {
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Loader2,
  MapPin,
  X,
} from "lucide-react";
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
import { applyLocationPrivacy } from "../lib/locationPrivacy";
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

// Privacy check: returns true if personal info is detected
function containsPersonalInfo(text: string): boolean {
  if (/\b\d[\d\s\-]{8,11}\d\b/.test(text)) return true;
  if (/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(text))
    return true;
  if (/@[a-zA-Z0-9_]{1,}/.test(text)) return true;
  if (/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(text)) return true;
  if (
    /\b(flat|room\s*no|room\s*number|apartment|house\s*no|house\s*number|block\s*no|block\s*number)\b/i.test(
      text,
    )
  )
    return true;
  return false;
}

// Harmful content check: returns true if hate speech, abuse, harassment, or threats are detected
function containsHarmfulContent(text: string): boolean {
  const lower = text.toLowerCase();

  // Hate speech — slurs and dehumanising language targeting groups
  const hateSpeechPatterns = [
    /\bn[i*][g*]{2}[e*]r\b/,
    /\bfagg[o0]t\b/,
    /\bk[i*]ke\b/,
    /\bsp[i*]c\b/,
    /\bch[i*]nk\b/,
    /\bwetback\b/,
    /\btr[a@]nny\b/,
    /\bretard(ed)?\b/,
    /\bsubhuman\b/,
    /\bvermin\b.*\b(people|community|group|race|religion)\b/,
    /\b(people|community|group|race|religion)\b.*\bvermin\b/,
  ];

  // Abusive / profane insults directed at a person
  const abusePatterns = [
    /\bf[u*][c*][k*]\s*(you|off|your)\b/,
    /\bgo\s+to\s+hell\b/,
    /\byou\s+(stupid|dumb|idiot|moron|imbecile|worthless|useless|piece\s+of\s+shit)\b/,
    /\bpiece\s+of\s+shit\b/,
    /\bbastard\b/,
    /\bbitc[h*]\b/,
    /\bwhore\b/,
    /\bslu[t*]\b/,
    /\bc[u*]nt\b/,
    /\bdouchebag\b/,
    /\bscumbag\b/,
  ];

  // Harassment toward individuals or communities
  const harassmentPatterns = [
    /\b(i\s+will|i'm\s+going\s+to|i\s+am\s+going\s+to)\s+(expose|destroy|ruin|humiliate|embarrass)\s+(you|them|him|her)\b/,
    /\b(everyone\s+should\s+hate|people\s+should\s+hate|\bboycott)\b/,
    /\bdie\s+(alone|in\s+a\s+fire|already|slowly)\b/,
    /\byou\s+don'?t\s+deserve\s+to\s+(live|exist|breathe)\b/,
    /\bkill\s+yourself\b/,
    /\bkys\b/,
    /\bgo\s+kill\s+yourself\b/,
  ];

  // Threats or violence
  const threatPatterns = [
    /\b(i\s+will|i'm\s+going\s+to|i\s+am\s+going\s+to|gonna)\s+(kill|hurt|beat|attack|stab|shoot|rape|harm|destroy)\s+(you|them|him|her|everyone)\b/,
    /\b(kill|murder|slaughter|exterminate)\s+(all|every|those)\b/,
    /\bthreat(en(ing)?)?\b.*\b(violence|harm|death)\b/,
    /\bbomb(ing)?\b/,
    /\bterror(ist|ism)?\b/,
    /\bmass\s+shooting\b/,
    /\bwipe\s+(out|them|you)\b/,
  ];

  const allPatterns = [
    ...hateSpeechPatterns,
    ...abusePatterns,
    ...harassmentPatterns,
    ...threatPatterns,
  ];

  return allPatterns.some((pattern) => pattern.test(lower));
}

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
  const [privacyError, setPrivacyError] = useState(false);
  const [harmfulError, setHarmfulError] = useState(false);

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
      setPrivacyError(false);
      setHarmfulError(false);
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
    setPrivacyError(false);
    setHarmfulError(false);

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

  function clearErrors() {
    setPrivacyError(false);
    setHarmfulError(false);
  }

  async function handleSubmit() {
    if (!isAuthenticated) {
      toast.error("Please log in to post a story.");
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

    const combined = `${title} ${content}`;

    // Harmful content check (hate speech, abuse, harassment, threats)
    if (containsHarmfulContent(combined)) {
      setHarmfulError(true);
      setPrivacyError(false);
      return;
    }

    // Privacy check on title + content combined
    if (containsPersonalInfo(combined)) {
      setPrivacyError(true);
      setHarmfulError(false);
      return;
    }

    clearErrors();
    setIsSubmitting(true);
    try {
      const imageBlob = await buildImageBlob();

      // Use picked location if available, otherwise default to 0,0
      let lat = pickedLocation?.lat ?? 0;
      let lng = pickedLocation?.lng ?? 0;

      // Apply location privacy (fuzzing + area snapping) only when user picked a location
      if (pickedLocation) {
        const privLoc = applyLocationPrivacy(lat, lng);
        lat = privLoc.lat;
        lng = privLoc.lng;
      }

      if (activeDraftId) {
        await publishDraft.mutateAsync(activeDraftId);
      } else {
        await createStory.mutateAsync({
          title: title.trim(),
          content: content.trim(),
          category,
          locationName: locationName.trim() || null,
          latitude: lat,
          longitude: lng,
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
      clearErrors();
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

  // Only title and content are required to post
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
              Share your story — location and image are optional.
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
                onChange={(e) => {
                  setTitle(e.target.value);
                  clearErrors();
                }}
                maxLength={100}
                data-ocid="story.title.input"
              />
            </div>

            {/* Content */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="story-content">Story</Label>
              {/* Privacy hint above text box */}
              <div
                className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2"
                data-ocid="story.privacy.hint"
              >
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  Do not include real names, phone numbers, or personal
                  information.
                </span>
              </div>
              <Textarea
                id="story-content"
                placeholder="Tell your story…"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  clearErrors();
                }}
                rows={5}
                maxLength={2000}
                data-ocid="story.content.textarea"
              />
            </div>

            {/* Harmful content error */}
            {harmfulError && (
              <div
                className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2.5 text-sm"
                data-ocid="story.harmful.error_state"
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Your story contains abusive or harmful language. Please edit
                  and try again.
                </span>
              </div>
            )}

            {/* Privacy error warning */}
            {privacyError && (
              <div
                className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2.5 text-sm"
                data-ocid="story.privacy.error_state"
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Please do not include names, phone numbers, addresses, or
                  personal information. Stories must remain anonymous.
                </span>
              </div>
            )}

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as Category)}
              >
                <SelectTrigger data-ocid="story.category.select">
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

            {/* Location picker */}
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
                Pick a location on the map to pin your story (optional).
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
                data-ocid="story.locationname.input"
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
                    className="w-full h-auto block rounded-lg"
                    style={{ maxHeight: "none", objectFit: "contain" }}
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

      {/* Location picker dialog */}
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
