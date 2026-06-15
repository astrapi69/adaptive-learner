/**
 * AvatarUpload — pick, interactively crop, downscale and preview a
 * profile picture, entirely client-side (#508, crop #558).
 *
 * Presentational + props-driven so it stays app-agnostic (reusability
 * policy): it renders the current avatar (the supplied image, else an
 * {@link InitialsAvatar} from ``name``), an upload button and — when a
 * picture is set — a remove button. On selection it opens an
 * {@link ImageCropDialog} so the user can position + zoom the image; on
 * confirm the cropped square Blob is converted to a base64 data URL and
 * reported via ``onChange`` (or ``null`` on remove). Every label is
 * supplied by the caller, and a processing failure is reported via
 * ``onError`` with a stable reason key the caller can translate.
 *
 * @example
 * <AvatarUpload
 *   name={user.name}
 *   value={settings.avatar}
 *   size={96}
 *   uploadLabel={t("settings.avatar_upload", "Upload picture")}
 *   removeLabel={t("settings.avatar_remove", "Remove")}
 *   cropLabels={{
 *     title: t("settings.avatar_crop_title", "Adjust your picture"),
 *     confirm: t("settings.avatar_crop_apply", "Apply"),
 *     cancel: t("settings.avatar_crop_cancel", "Cancel"),
 *   }}
 *   onChange={(dataUrl) => saveAvatar(dataUrl)}
 *   onError={(key) => notify.error(t(key, "Could not use that image."))}
 * />
 */

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import InitialsAvatar from "./InitialsAvatar";
import ImageCropDialog from "./ImageCropDialog";
import {
  AVATAR_MAX_BYTES,
  AVATAR_MAX_DIMENSION,
  dataUrlByteLength,
  isAcceptedImageType,
} from "../lib/avatar/resize-image";
import { blobToDataUrl } from "../lib/avatar/crop-image";

export interface AvatarCropLabels {
  title?: string;
  instructions?: string;
  confirm?: string;
  cancel?: string;
  zoom?: string;
}

export interface AvatarUploadProps {
  /** Display name for the initials fallback. */
  name: string;
  /** Current avatar data URL, or null/empty for the initials fallback. */
  value: string | null;
  /** Preview diameter in px. Defaults to 96. */
  size?: number;
  uploadLabel: string;
  removeLabel: string;
  /** Translatable labels for the crop dialog (English defaults apply). */
  cropLabels?: AvatarCropLabels;
  /** Receives the new data URL, or null when removed. */
  onChange: (dataUrl: string | null) => void;
  /** Receives a stable, translatable reason key on a processing failure. */
  onError?: (reasonKey: string) => void;
  testId?: string;
}

export default function AvatarUpload({
  name,
  value,
  size = 96,
  uploadLabel,
  removeLabel,
  cropLabels,
  onChange,
  onError,
  testId,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<File | null>(null);

  function resetInput(): void {
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleFile(file: File | undefined): void {
    if (!file) return;
    if (!isAcceptedImageType(file.type)) {
      onError?.("avatar.error.unsupported_type");
      resetInput();
      return;
    }
    setPending(file);
  }

  async function handleCropConfirm(blob: Blob): Promise<void> {
    setBusy(true);
    try {
      const dataUrl = await blobToDataUrl(blob);
      if (dataUrlByteLength(dataUrl) > AVATAR_MAX_BYTES) {
        onError?.("avatar.error.too_large");
        return;
      }
      onChange(dataUrl);
    } catch {
      onError?.("avatar.error.decode_failed");
    } finally {
      setBusy(false);
      setPending(null);
      resetInput();
    }
  }

  function handleCropCancel(): void {
    setPending(null);
    resetInput();
  }

  return (
    <div className="flex items-center gap-4" data-testid={testId}>
      {value ? (
        <img
          src={value}
          alt=""
          aria-hidden="true"
          className="shrink-0 rounded-full object-cover"
          style={{ width: size, height: size }}
          data-testid="avatar-preview-image"
        />
      ) : (
        <InitialsAvatar name={name} size={size} testId="avatar-preview-initials" />
      )}
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          data-testid="avatar-file-input"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 gap-1.5"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          data-testid="avatar-upload-button"
        >
          <ImagePlus aria-hidden="true" />
          {uploadLabel}
        </Button>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 gap-1.5"
            disabled={busy}
            onClick={() => onChange(null)}
            data-testid="avatar-remove-button"
          >
            <Trash2 aria-hidden="true" />
            {removeLabel}
          </Button>
        ) : null}
      </div>
      {pending ? (
        <ImageCropDialog
          image={pending}
          outputSize={AVATAR_MAX_DIMENSION}
          shape="circle"
          title={cropLabels?.title}
          instructions={cropLabels?.instructions}
          confirmLabel={cropLabels?.confirm}
          cancelLabel={cropLabels?.cancel}
          zoomLabel={cropLabels?.zoom}
          onConfirm={(blob) => void handleCropConfirm(blob)}
          onCancel={handleCropCancel}
        />
      ) : null}
    </div>
  );
}
