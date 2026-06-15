/**
 * AvatarUpload — pick, square-crop, downscale and preview a profile
 * picture, entirely client-side (#508).
 *
 * Presentational + props-driven so it stays app-agnostic (reusability
 * policy): it renders the current avatar (the supplied image, else an
 * {@link InitialsAvatar} from ``name``), an upload button and — when a
 * picture is set — a remove button. On selection it processes the file
 * with {@link processAvatarFile} and reports the resulting base64 data
 * URL via ``onChange`` (or ``null`` on remove). Every label is supplied
 * by the caller, and a processing failure is reported via ``onError``
 * with a stable reason key the caller can translate + surface.
 *
 * @example
 * <AvatarUpload
 *   name={user.name}
 *   value={settings.avatar}
 *   size={96}
 *   uploadLabel={t("settings.avatar.upload", "Upload picture")}
 *   removeLabel={t("settings.avatar.remove", "Remove")}
 *   onChange={(dataUrl) => saveAvatar(dataUrl)}
 *   onError={(key) => notify.error(t(key, "Could not use that image."))}
 * />
 */

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import InitialsAvatar from "./InitialsAvatar";
import { processAvatarFile } from "../lib/avatar/resize-image";

export interface AvatarUploadProps {
  /** Display name for the initials fallback. */
  name: string;
  /** Current avatar data URL, or null/empty for the initials fallback. */
  value: string | null;
  /** Preview diameter in px. Defaults to 96. */
  size?: number;
  uploadLabel: string;
  removeLabel: string;
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
  onChange,
  onError,
  testId,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await processAvatarFile(file);
      onChange(dataUrl);
    } catch (err) {
      const key = err instanceof Error ? err.message : "avatar.error.decode_failed";
      onError?.(key);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
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
          onChange={(e) => void handleFile(e.target.files?.[0])}
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
    </div>
  );
}
