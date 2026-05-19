/* ═══ Client-side image compression for avatar upload ═══
 *
 * Resize + re-encode large user-selected photos so we can persist them as
 * base64 in localStorage / Firestore without blowing past quota or making
 * the app sluggish.
 *
 * Default profile target: 256x256 max, JPEG q=0.85 → typically 10-30 KB.
 */

export interface CompressOptions {
  /** Max width/height in pixels. Aspect ratio preserved. */
  maxSize?: number;
  /** JPEG quality 0..1. Higher = better but bigger. */
  quality?: number;
  /** Override output MIME. Defaults to image/jpeg (smaller than PNG for photos). */
  mimeType?: 'image/jpeg' | 'image/webp' | 'image/png';
}

const DEFAULTS: Required<CompressOptions> = {
  maxSize: 256,
  quality: 0.85,
  mimeType: 'image/jpeg',
};

/**
 * Read a File, resize to fit within maxSize × maxSize keeping aspect ratio,
 * re-encode at the given quality, and return a base64 data URL.
 *
 * Rejects on unreadable files or canvas/encode failure.
 */
export async function compressImageToDataURL(
  file: File,
  options: CompressOptions = {},
): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('compressImageToDataURL requires a browser environment');
  }
  const opts = { ...DEFAULTS, ...options };
  if (!file.type.startsWith('image/')) {
    throw new Error('File is not an image');
  }

  const dataUrl = await readFileAsDataURL(file);
  const img = await loadImage(dataUrl);

  const ratio = Math.min(opts.maxSize / img.width, opts.maxSize / img.height, 1);
  const targetW = Math.round(img.width * ratio);
  const targetH = Math.round(img.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Better quality downscale on most browsers
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetW, targetH);

  return canvas.toDataURL(opts.mimeType, opts.quality);
}

/** Convenience: returns rough KB size of a data URL. */
export function estimateDataURLSize(dataUrl: string): number {
  // base64 inflates by ~33%; subtract header.
  const commaIdx = dataUrl.indexOf(',');
  const body = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  return Math.round((body.length * 3) / 4 / 1024); // KB
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Unexpected reader result type'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = src;
  });
}
