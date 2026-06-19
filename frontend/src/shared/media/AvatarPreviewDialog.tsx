/**
 * AvatarPreviewDialog — a large, centered preview of a profile picture
 * with a "change" and a "close" action (#638).
 *
 * Fully presentational + props-driven (reusability policy): it shows the
 * supplied ``imageUrl`` large (capped at 80vw/80vh), dims the rest of the
 * screen with the overlay token, and offers two buttons. Every label is a
 * prop with an English default, so it is app-agnostic and i18n-friendly.
 * Closing is wired three ways — the Close button, the Escape key, and a
 * click on the backdrop — and focus is trapped + restored via
 * {@link useDialogFocus}. There is no storage impact, so it works
 * identically in both storage modes.
 *
 * @example
 * const [preview, setPreview] = useState(false);
 * return preview ? (
 *   <AvatarPreviewDialog
 *     imageUrl={avatarUrl}
 *     title={t("settings.avatar_preview_title", "Profile picture")}
 *     changeLabel={t("settings.avatar_change", "Change picture")}
 *     closeLabel={t("common.close", "Close")}
 *     onChange={() => { setPreview(false); openUpload(); }}
 *     onClose={() => setPreview(false)}
 *   />
 * ) : null;
 */

import { useEffect, useRef } from "react";
import { ImagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useDialogFocus } from "../../hooks/ui/useDialogFocus";

export interface AvatarPreviewDialogProps {
  /** Data URL (or any image src) to preview. */
  imageUrl: string;
  /** Opens the change/upload flow — the caller decides what that is. */
  onChange: () => void;
  /** Called on Close / Escape / backdrop click. */
  onClose: () => void;
  title?: string;
  changeLabel?: string;
  closeLabel?: string;
  testId?: string;
}

export default function AvatarPreviewDialog({
  imageUrl,
  onChange,
  onClose,
  title = "Profile picture",
  changeLabel = "Change picture",
  closeLabel = "Close",
  testId = "avatar-preview-dialog",
}: AvatarPreviewDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useDialogFocus(dialogRef, { open: true });

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4"
      data-testid={testId}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${testId}-title`}
        className="flex max-w-[min(90vw,32rem)] flex-col gap-4 rounded-app border border-border bg-background p-6 shadow-lg"
      >
        <h2
          id={`${testId}-title`}
          data-testid={`${testId}-title`}
          className="text-lg font-semibold leading-none tracking-tight text-fg-primary"
        >
          {title}
        </h2>

        <div className="flex justify-center">
          <img
            src={imageUrl}
            alt=""
            aria-hidden="true"
            className="rounded-app object-contain"
            style={{ maxWidth: "80vw", maxHeight: "80vh" }}
            data-testid="avatar-preview-large"
          />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={onClose}
            data-testid="avatar-preview-close"
          >
            {closeLabel}
          </Button>
          <Button
            type="button"
            className="min-h-11 gap-1.5"
            onClick={onChange}
            data-autofocus
            data-testid="avatar-preview-change"
          >
            <ImagePlus aria-hidden="true" />
            {changeLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
