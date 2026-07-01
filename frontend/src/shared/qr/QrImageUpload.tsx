/**
 * QrImageUpload — a reusable "upload a QR image to read it" control.
 *
 * A file-picker button that decodes the chosen image with {@link decodeQrImage}
 * (the bundled ``html5-qrcode`` decoder, client-side, offline-first) and hands
 * the raw decoded string to ``onResult``. On a decode failure (no QR in the
 * image) it shows the caller-provided ``labels.decodeError`` message inline.
 *
 * App-agnostic + props-driven: all copy arrives via ``labels`` (no i18n import),
 * and content-specific validation of the decoded payload is the caller's job
 * (it happens in ``onResult``). This lets any QR-reading surface — sync pairing,
 * content-repo add, invitation redeem — reuse the same control. Token-backed
 * Tailwind only.
 *
 * @example
 * <QrImageUpload
 *   onResult={(raw) => { const p = parseAddRepoQr(raw); ... }}
 *   labels={{ upload: t("…"), decoding: t("…"), decodeError: t("…") }}
 * />
 */

import { QrCode } from "lucide-react";
import { useRef, useState } from "react";

import { decodeQrImage } from "./decode-qr-image";

export interface QrImageUploadLabels {
  /** Button label in the idle state. */
  upload: string;
  /** Button label while decoding. */
  decoding: string;
  /** Inline message shown when no QR code is found in the image. */
  decodeError: string;
}

export interface QrImageUploadProps {
  /** Called with the raw decoded QR string on a successful decode. */
  onResult: (raw: string) => void;
  labels: QrImageUploadLabels;
  /** Test id prefix (default ``qr-image-upload``). */
  testId?: string;
  /** Optional extra classes on the wrapper. */
  className?: string;
}

type Status = "idle" | "decoding" | "error";

export default function QrImageUpload({
  onResult,
  labels,
  testId = "qr-image-upload",
  className,
}: QrImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  async function handleFile(file: File) {
    setStatus("decoding");
    try {
      const decoded = await decodeQrImage(file);
      setStatus("idle");
      onResult(decoded);
    } catch {
      // ``scanFile`` rejects on "no QR found" and on image-decode errors;
      // both map to the same user-facing "no QR in the image" message.
      setStatus("error");
    } finally {
      // Reset so re-picking the same file fires ``change`` again.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <div className={className} data-testid={testId}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === "decoding"}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg-secondary hover:bg-muted disabled:opacity-60"
        data-testid={`${testId}-button`}
      >
        <QrCode size={16} aria-hidden="true" />
        {status === "decoding" ? labels.decoding : labels.upload}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onChange}
        className="hidden"
        data-testid={`${testId}-input`}
      />
      {status === "error" && (
        <p
          className="mt-2 text-sm text-[var(--danger)]"
          role="status"
          aria-live="polite"
          data-testid={`${testId}-error`}
        >
          {labels.decodeError}
        </p>
      )}
    </div>
  );
}
