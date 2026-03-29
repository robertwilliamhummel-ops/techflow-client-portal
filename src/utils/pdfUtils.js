/**
 * pdfUtils.js
 * ─────────────────────────────────────────────────────────────────────────
 * Shared helpers for turning a base64 PDF string into something the user
 * can actually see, on both desktop and mobile.
 *
 * WHY THIS FILE EXISTS
 * ──────────────────────
 * Mobile browsers (iOS Safari, Android Chrome/WebView) have two hard limits:
 *
 *   1. They cannot render PDFs inside <iframe src="blob:..."> — the iframe
 *      simply stays blank or the browser silently swallows the request.
 *
 *   2. URL.createObjectURL() blob URLs must stay alive until the browser has
 *      fully consumed them. Revoking immediately after .click() (as the old
 *      code did) kills the URL before mobile has a chance to open it.
 *
 * STRATEGY
 * ──────────
 *   Desktop  → create a blob URL → set on an <iframe> for inline preview.
 *              (unchanged UX — users see the PDF in-page before downloading)
 *
 *   Mobile   → convert base64 → Blob → Object URL → hidden <a download> →
 *              programmatic .click(). The OS hands the file to its native
 *              PDF viewer (Files app on iOS, Downloads on Android).
 *              The blob URL is revoked after a 2-second safety delay.
 * ─────────────────────────────────────────────────────────────────────────
 */

/**
 * Returns true when running on a mobile/tablet device.
 * Uses matchMedia as primary signal (reliable, CSS-consistent) with a
 * userAgent string as a fallback for devices that lie about viewport width.
 */
export function isMobileDevice() {
  // matchMedia — consistent with the 768 px breakpoint used everywhere else
  const narrowViewport = window.matchMedia('(max-width: 767px)').matches;

  // UA fallback — catches tablets that report wide viewports
  const mobileUA = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  return narrowViewport || mobileUA;
}

/**
 * Converts a raw base64 string (no data-URI prefix) into a Uint8Array.
 */
export function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Triggers a native-download of a PDF on mobile.
 *
 * Creates a hidden <a download> element, clicks it, then revokes the blob
 * URL after a 2-second delay (giving the OS time to read the file before
 * we free the memory).
 *
 * @param {string} base64   - Raw base64 PDF data (no data: prefix)
 * @param {string} filename - e.g. "Invoice-TFS-2026-0001.pdf"
 */
export function downloadPdfMobile(base64, filename) {
  const bytes = base64ToBytes(base64);
  const blob  = new Blob([bytes], { type: 'application/pdf' });
  const url   = URL.createObjectURL(blob);

  const link       = document.createElement('a');
  link.href        = url;
  link.download    = filename;
  link.rel         = 'noopener noreferrer';

  // Must be in the DOM for Firefox and some Android WebViews
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // 2-second delay before revoke — mobile browsers read the blob async
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Creates a blob URL suitable for an <iframe src> on desktop.
 * Returns the URL string — caller is responsible for calling
 * URL.revokeObjectURL() when the iframe is closed.
 *
 * @param {string} base64 - Raw base64 PDF data
 * @returns {string}       - Object URL (blob:https://...)
 */
export function createPdfBlobUrl(base64) {
  const bytes = base64ToBytes(base64);
  const blob  = new Blob([bytes], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}
