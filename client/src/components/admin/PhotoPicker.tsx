import * as React from "react";
import { Camera, Plus, X } from "lucide-react";
import { Badge, TextInput } from "@/components/ios";
import { cn } from "@/lib/utils";

export type PhotoDraft = { id: string; file: File; preview: string; label: string };

const MAX_FILE_BYTES = 25 * 1024 * 1024;
let sequence = 0;
const newId = () => `photo-${Date.now().toString(36)}-${(sequence++).toString(36)}`;

type PhotoPickerProps = {
  photos: PhotoDraft[];
  coverId: string | null;
  onChange: (photos: PhotoDraft[], coverId: string | null) => void;
  min: number;
  max: number;
  disabled?: boolean;
  onProblem?: (message: string) => void;
};

/** Frees the temporary preview URLs when the picker goes away. */
function useRevokeOnUnmount(photos: PhotoDraft[]) {
  const latest = React.useRef(photos);
  latest.current = photos;
  React.useEffect(() => () => latest.current.forEach(photo => URL.revokeObjectURL(photo.preview)), []);
}

export function PhotoPicker({ photos, coverId, onChange, min, max, disabled, onProblem }: PhotoPickerProps) {
  useRevokeOnUnmount(photos);

  function addFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    const accepted = files.filter(file => file.type.startsWith("image/") && file.size <= MAX_FILE_BYTES);
    if (accepted.length !== files.length) onProblem?.("Only image files up to 25 MB were added.");
    const room = Math.max(0, max - photos.length);
    if (accepted.length > room) onProblem?.(`You can add up to ${max} photos.`);
    const added = accepted.slice(0, room).map(file => ({ id: newId(), file, preview: URL.createObjectURL(file), label: "" }));
    const next = [...photos, ...added];
    onChange(next, coverId ?? next[0]?.id ?? null);
  }

  function remove(id: string) {
    const removed = photos.find(photo => photo.id === id);
    if (removed) URL.revokeObjectURL(removed.preview);
    const next = photos.filter(photo => photo.id !== id);
    onChange(next, coverId === id ? (next[0]?.id ?? null) : coverId);
  }

  const setLabel = (id: string, label: string) => onChange(photos.map(photo => (photo.id === id ? { ...photo, label } : photo)), coverId);
  // JPEG, PNG and WebP are listed explicitly because iPhones then convert HEIC photos to JPEG automatically.
  const picker = <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled} onChange={event => { addFiles(event.target.files); event.target.value = ""; }} className="sr-only" />;

  if (photos.length === 0) {
    return (
      <label className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-group border-2 border-dashed border-separator-strong bg-fill-4 px-6 py-10 text-center transition-colors hover:bg-fill-3", disabled && "pointer-events-none opacity-50")}>
        <span className="grid size-14 place-items-center rounded-full bg-tint-soft text-tint-text">
          <Camera className="size-7" aria-hidden />
        </span>
        <span className="text-headline font-semibold">Add photos</span>
        <span className="text-subhead text-label-2">At least {min}. Take them now or choose from your library.</span>
        {picker}
      </label>
    );
  }

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo, index) => {
          const isCover = photo.id === coverId;
          return (
            <li key={photo.id} className="overflow-hidden rounded-[16px] bg-surface shadow-[inset_0_0_0_0.5px_var(--separator-strong)]">
              <div className="relative aspect-square bg-fill-4">
                <img src={photo.preview} alt={`Photo ${index + 1}`} className="size-full object-cover" draggable={false} />
                {isCover && <Badge tone="blue" className="absolute left-2 top-2 bg-surface/90 backdrop-blur">Cover</Badge>}
                <button
                  type="button"
                  aria-label={`Remove photo ${index + 1}`}
                  onClick={() => remove(photo.id)}
                  disabled={disabled}
                  className="material press absolute right-2 top-2 grid size-8 place-items-center rounded-full">
                  <X className="size-4" strokeWidth={2.5} />
                </button>
              </div>
              <div className="space-y-1.5 p-2">
                <TextInput
                  aria-label={`Label for photo ${index + 1}`}
                  placeholder="Label (optional)"
                  value={photo.label}
                  disabled={disabled}
                  onChange={event => setLabel(photo.id, event.target.value)}
                  className="h-9 px-3 text-subhead"
                />
                {!isCover && (
                  <button type="button" disabled={disabled} onClick={() => onChange(photos, photo.id)} className="px-1 text-footnote font-medium text-tint-text">
                    Make cover photo
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {photos.length < max && (
          <li>
            <label className={cn("flex aspect-square h-full min-h-[10rem] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[16px] border-2 border-dashed border-separator-strong bg-fill-4 text-tint-text transition-colors hover:bg-fill-3", disabled && "pointer-events-none opacity-50")}>
              <Plus className="size-7" aria-hidden />
              <span className="text-subhead font-medium">Add more</span>
              {picker}
            </label>
          </li>
        )}
      </ul>
      <p className={cn("mt-3 text-footnote", photos.length < min ? "font-medium text-ios-orange-text" : "text-label-2")}>
        {photos.length} {photos.length === 1 ? "photo" : "photos"}
        {photos.length < min ? ` · add ${min - photos.length} more to publish` : " · the cover photo appears on the product tile"}
      </p>
    </div>
  );
}
