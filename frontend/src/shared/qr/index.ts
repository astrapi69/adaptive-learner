/**
 * Reusable QR-reading building blocks (client-side, offline-first).
 *
 * ``decodeQrImage`` decodes a QR from an image file via the bundled
 * ``html5-qrcode`` decoder; ``QrImageUpload`` is the props-driven file-picker
 * control that wraps it. App-agnostic — any QR-reading surface shares these.
 */
export { decodeQrImage } from "./decode-qr-image";
export { default as QrImageUpload } from "./QrImageUpload";
export type { QrImageUploadLabels, QrImageUploadProps } from "./QrImageUpload";
