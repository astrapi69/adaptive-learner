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
 * The avatar itself is clickable (#638): with a picture set it opens an
 * {@link AvatarPreviewDialog} (large preview + "change"); without one it
 * jumps straight to the file picker. A camera-icon overlay on hover /
 * focus signals the affordance.
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
import { Camera, ImagePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import InitialsAvatar from "./InitialsAvatar";
import ImageCropDialog from "./ImageCropDialog";
import AvatarPreviewDialog from "./AvatarPreviewDialog";
import {
  AVATAR_MAX_BYTES,
  AVATAR_MAX_DIMENSION,
  dataUrlByteLength,
  isAcceptedImageType,
} from "../../lib/avatar/resize-image";
import { blobToDataUrl } from "../../lib/avatar/crop-image";

export interface AvatarCropLabels {
  title?: string;
  instructions?: string;
  confirm?: string;
  cancel?: string;
  zoom?: string;
}

export interface AvatarPreviewLabels {
  title?: string;
  change?: string;
  close?: string;
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
  /** Translatable labels for the preview dialog (English defaults apply). */
  previewLabels?: AvatarPreviewLabels;
  /** Accessible name for the clickable avatar (English default applies). */
  avatarButtonLabel?: string;
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
  previewLabels,
  avatarButtonLabel = "View or change profile picture",
  onChange,
  onError,
  testId,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);

  function openFilePicker(): void {
    inputRef.current?.click();
  }

  /** With a picture, preview it; without one, jump straight to upload. */
  function handleAvatarClick(): void {
    if (value) setPreviewing(true);
    else openFilePicker();
  }

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
      <button
        type="button"
        onClick={handleAvatarClick}
        disabled={busy}
        aria-label={avatarButtonLabel}
        title={avatarButtonLabel}
        data-testid="avatar-trigger"
        className="group relative inline-flex shrink-0 cursor-pointer rounded-full p-0 leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        style={{ minWidth: 44, minHeight: 44 }}
      >
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
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-[var(--bg-overlay)] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
          data-testid="avatar-trigger-overlay"
        >
          <Camera className="text-white" aria-hidden="true" />
        </span>
      </button>
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
          onClick={openFilePicker}
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
      {previewing && value ? (
        <AvatarPreviewDialog
          imageUrl={value}
          title={previewLabels?.title}
          changeLabel={previewLabels?.change}
          closeLabel={previewLabels?.close}
          onChange={() => {
            setPreviewing(false);
            openFilePicker();
          }}
          onClose={() => setPreviewing(false)}
        />
      ) : null}
    </div>
  );
}
