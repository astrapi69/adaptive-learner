/**
 * decodeQrImage — decode a QR code from an image file, client-side.
 *
 * Reuses the ``html5-qrcode`` library already bundled for the live camera
 * scanner: ``Html5Qrcode.scanFile`` accepts a ``File`` directly and decodes it
 * with no network round-trip (offline-first). The library needs a DOM element
 * to mount its internal canvas, so this helper creates a throwaway off-screen
 * ``<div>``, uses it, and removes it again — callers just pass a ``File`` and
 * get back the decoded string.
 *
 * Rejects when the image contains no QR code (or cannot be decoded); the caller
 * surfaces a friendly message. App-agnostic: no i18n / storage / app imports,
 * so any QR-reading surface (sync pairing, content-repo add, …) can share it.
 *
 * @example
 * const raw = await decodeQrImage(file); // throws if no QR found
 */

import { Html5Qrcode } from "html5-qrcode";

/** Monotonic suffix so concurrent decodes never collide on the mount id. */
let regionSeq = 0;

/**
 * Decode the first QR code found in ``file``.
 *
 * @param file - An image file (PNG / JPG / …) picked by the user.
 * @returns The decoded QR payload string.
 * @throws If the image has no detectable QR code or cannot be decoded.
 */
export async function decodeQrImage(file: File): Promise<string> {
  regionSeq += 1;
  const regionId = `qr-decode-region-${regionSeq}`;
  const region = document.createElement("div");
  region.id = regionId;
  region.setAttribute("aria-hidden", "true");
  region.style.position = "absolute";
  region.style.left = "-9999px";
  region.style.top = "-9999px";
  region.style.width = "1px";
  region.style.height = "1px";
  region.style.overflow = "hidden";
  document.body.appendChild(region);

  const scanner = new Html5Qrcode(regionId);
  try {
    // ``showImage=false`` suppresses the library's own preview render.
    return await scanner.scanFile(file, false);
  } finally {
    region.remove();
  }
}
