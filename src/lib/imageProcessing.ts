import { LIMITS, type ImageSettings, type OutputFormat, type ProcessedImage } from '../types';
import { sanitizeFilename } from './filenames';

const INPUT_FORMATS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function calculateDimensions(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  if (![width, height, maxWidth, maxHeight].every(Number.isFinite) || width <= 0 || height <= 0 || maxWidth <= 0 || maxHeight <= 0) {
    throw new Error('Image dimensions and size limits must be positive numbers.');
  }
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function validateSettings(settings: ImageSettings): void {
  if (!settings || !['image/jpeg', 'image/png', 'image/webp'].includes(settings.format)) {
    throw new Error('Choose JPEG, PNG, or WebP as the output format.');
  }
  for (const [label, value] of [['Maximum width', settings.maxWidth], ['Maximum height', settings.maxHeight]] as const) {
    if (!Number.isInteger(value) || value < 1 || value > LIMITS.maxOutputDimension) {
      throw new Error(`${label} must be a whole number from 1 to ${LIMITS.maxOutputDimension} pixels.`);
    }
  }
  if (!Number.isFinite(settings.quality) || settings.quality < 0 || settings.quality > 1) {
    throw new Error('Quality must be between 0 and 1.');
  }
  if (settings.targetBytes !== undefined && (!Number.isInteger(settings.targetBytes) || settings.targetBytes < 1 || settings.targetBytes > LIMITS.maxBytes)) {
    throw new Error(`Target file size must be a whole number from 1 byte to ${formatBytes(LIMITS.maxBytes)}.`);
  }
  if (typeof settings.background !== 'string' || !/^#[0-9a-f]{6}$/i.test(settings.background)) {
    throw new Error('Background must be a six-digit hex color, such as #ffffff.');
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let i = 0; value >= 1024 && i < units.length - 1; i++) {
    value /= 1024;
    unit = units[i + 1];
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${unit}`;
}

/** Percentage saved; a negative value means the processed file grew. */
export function getSizeChange(originalBytes: number, outputBytes: number): number {
  if (!Number.isFinite(originalBytes) || originalBytes <= 0 || !Number.isFinite(outputBytes) || outputBytes < 0) return 0;
  return ((originalBytes - outputBytes) / originalBytes) * 100;
}

export function makeOutputName(originalName: string, format: OutputFormat): string {
  const extension = format === 'image/jpeg' ? 'jpg' : format === 'image/png' ? 'png' : 'webp';
  const base = originalName.replace(/[\\/]+/g, '/').split('/').pop() || 'image';
  const stem = base.replace(/\.[^.]*$/, '').trim() || 'image';
  return sanitizeFilename(`${stem}.${extension}`);
}

/** Reserves the returned filename in `used`; collisions are checked case-insensitively. */
export function reserveUniqueName(name: string, used: Set<string>): string {
  const normalized = (candidate: string) => candidate.toLocaleLowerCase();
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : '';
  let candidate = name;
  let suffix = 2;
  while (used.has(normalized(candidate))) candidate = `${stem} (${suffix++})${extension}`;
  used.add(normalized(candidate));
  return candidate;
}

export function validateInputFile(file: File): void {
  if (!file || typeof file.size !== 'number') throw new Error('Choose an image file to continue.');
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const byExtension = ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as Record<string, string>)[extension];
  const mime = file.type.toLowerCase();
  const byMime = mime === 'image/jpg' ? 'image/jpeg' : mime;
  if (!byExtension && !INPUT_FORMATS[byMime]) throw new Error('Choose a JPEG, PNG, or WebP image.');
  if (byMime && INPUT_FORMATS[byMime] && byExtension && byMime !== byExtension) {
    throw new Error('The file extension and image type do not match.');
  }
  if (file.size <= 0) throw new Error('This image file is empty.');
  if (file.size > LIMITS.maxBytes) throw new Error(`Images must be ${formatBytes(LIMITS.maxBytes)} or smaller.`);
}

export interface BatchBudget {
  bytes: number;
  pixels: number;
}

/** Rejects additions that would exceed the conservative in-memory batch limits. */
export function validateBatchBudget(current: BatchBudget, incoming: BatchBudget): void {
  for (const budget of [current, incoming]) {
    if (!Number.isFinite(budget.bytes) || budget.bytes < 0 || !Number.isFinite(budget.pixels) || budget.pixels < 0) {
      throw new Error('Batch size information must use nonnegative byte and pixel counts.');
    }
  }
  if (current.bytes + incoming.bytes > LIMITS.maxBatchBytes) {
    throw new Error(`The selected images would exceed the ${formatBytes(LIMITS.maxBatchBytes)} total batch limit.`);
  }
  if (current.pixels + incoming.pixels > LIMITS.maxBatchPixels) {
    throw new Error(`The selected images would exceed the ${LIMITS.maxBatchPixels / 1_000_000} megapixel total batch limit.`);
  }
}

function sniffImage(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && String.fromCharCode(...bytes.slice(1, 4)) === 'PNG' && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

export function readHeaderDimensions(bytes: Uint8Array, mime: string): { width: number; height: number } | null {
  const u16be = (o: number) => bytes[o] * 256 + bytes[o + 1];
  const u16le = (o: number) => bytes[o] | bytes[o + 1] << 8;
  const u24le = (o: number) => bytes[o] | bytes[o + 1] << 8 | bytes[o + 2] << 16;
  const u32be = (o: number) => bytes[o] * 0x1000000 + (bytes[o + 1] << 16 | bytes[o + 2] << 8 | bytes[o + 3]);
  if (mime === 'image/png' && bytes.length >= 24 && String.fromCharCode(...bytes.slice(12, 16)) === 'IHDR') return { width: u32be(16), height: u32be(20) };
  if (mime === 'image/webp' && bytes.length >= 30) {
    const chunk = String.fromCharCode(...bytes.slice(12, 16));
    if (chunk === 'VP8X') return { width: 1 + u24le(24), height: 1 + u24le(27) };
    if (chunk === 'VP8 ') return { width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
    if (chunk === 'VP8L' && bytes[20] === 0x2f && bytes.length >= 25) {
      return { width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8), height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10) };
    }
  }
  if (mime === 'image/jpeg') {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset++; continue; }
      let marker = bytes[offset + 1];
      while (marker === 0xff) marker = bytes[++offset + 1];
      const length = u16be(offset + 2);
      if (length < 2 || offset + 2 + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (length < 8) break;
        return { height: u16be(offset + 5), width: u16be(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  return null;
}

/** Reads dimensions from headers when possible to reject oversized inputs before decoding. */
export async function inspectImage(file: File): Promise<{ width: number; height: number }> {
  validateInputFile(file);
  const { header } = await inspectHeader(file);
  if (header && header.width > 0 && header.height > 0 && header.width * header.height > LIMITS.maxPixels) {
    throw new Error(`Images must be ${LIMITS.maxPixels / 1_000_000} megapixels or smaller.`);
  }
  const decoded = await decodeImage(file);
  try {
    if (decoded.width * decoded.height > LIMITS.maxPixels) throw new Error(`Images must be ${LIMITS.maxPixels / 1_000_000} megapixels or smaller.`);
    return { width: decoded.width, height: decoded.height };
  } finally { decoded.close(); }
}

async function inspectHeader(file: File): Promise<{ actualMime: string; header: { width: number; height: number } | null }> {
  const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, 256 * 1024)).arrayBuffer());
  const actualMime = sniffImage(bytes);
  if (!actualMime) throw new Error('This file does not contain a readable JPEG, PNG, or WebP image.');
  const ext = file.name.split('.').pop()?.toLowerCase();
  const extensionMime = ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as Record<string, string>)[ext ?? ''];
  const declaredMime = INPUT_FORMATS[file.type.toLowerCase()] ? file.type.toLowerCase() : '';
  if ((extensionMime && extensionMime !== actualMime) || (declaredMime && declaredMime !== actualMime)) {
    throw new Error('The file contents do not match its name or image type.');
  }
  if (actualMime === 'image/webp' && bytes.length >= 21 && String.fromCharCode(...bytes.slice(12, 16)) === 'VP8X' && (bytes[20] & 0x02) !== 0) {
    throw new Error('Animated WebP images are not supported. Choose a still image.');
  }
  if (actualMime === 'image/png') {
    let offset = 8;
    while (offset + 8 <= bytes.length) {
      const size = bytes[offset] * 0x1000000 + (bytes[offset + 1] << 16 | bytes[offset + 2] << 8 | bytes[offset + 3]);
      const chunk = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
      if (chunk === 'acTL') throw new Error('Animated PNG images are not supported. Choose a still image.');
      if (offset + 12 + size > bytes.length) break;
      offset += 12 + size;
    }
  }
  return { actualMime, header: readHeaderDimensions(bytes, actualMime) };
}

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };
async function decodeImage(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch { /* Fall through for browsers that cannot decode via ImageBitmap. */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => { img.src = ''; URL.revokeObjectURL(url); } };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw new Error(`Could not read this image: ${error instanceof Error ? error.message : 'unsupported or damaged file'}`);
  }
}

function exportCanvas(canvas: HTMLCanvasElement, mime: OutputFormat, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The browser could not export this image.')), mime, quality));
}

export interface TargetSizeResult {
  blob: Blob;
  quality: number;
  targetMet: boolean;
}

/** Chooses the highest sampled quality that reaches the target, with at most seven encodes. */
export async function chooseQualityForTarget(
  encode: (quality: number) => Promise<Blob>,
  targetBytes: number,
  maxQuality: number,
  minQuality = Math.min(0.1, maxQuality),
): Promise<TargetSizeResult> {
  const highBlob = await encode(maxQuality);
  if (highBlob.size <= targetBytes) return { blob: highBlob, quality: maxQuality, targetMet: true };
  if (minQuality >= maxQuality) return { blob: highBlob, quality: maxQuality, targetMet: false };

  const lowBlob = await encode(minQuality);
  if (lowBlob.size > targetBytes) return { blob: lowBlob, quality: minQuality, targetMet: false };

  let best = { blob: lowBlob, quality: minQuality, targetMet: true };
  let low = minQuality;
  let high = maxQuality;
  // Two boundary encodes above plus these five mids stays within seven attempts.
  for (let attempt = 0; attempt < 5; attempt++) {
    const quality = (low + high) / 2;
    const blob = await encode(quality);
    if (blob.size <= targetBytes) {
      best = { blob, quality, targetMet: true };
      low = quality;
    } else high = quality;
  }
  return best;
}

export async function processImage(file: File, settings: ImageSettings, outputName?: string): Promise<ProcessedImage> {
  validateSettings(settings);
  validateInputFile(file);
  const { header } = await inspectHeader(file);
  if (header && header.width > 0 && header.height > 0 && header.width * header.height > LIMITS.maxPixels) {
    throw new Error(`Images must be ${LIMITS.maxPixels / 1_000_000} megapixels or smaller.`);
  }
  const decoded = await decodeImage(file);
  let canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  try {
    // Bitmap dimensions may include EXIF orientation; use these for correct oriented output.
    if (decoded.width * decoded.height > LIMITS.maxPixels) throw new Error(`Images must be ${LIMITS.maxPixels / 1_000_000} megapixels or smaller.`);
    const size = calculateDimensions(decoded.width, decoded.height, settings.maxWidth, settings.maxHeight);
    if (typeof OffscreenCanvas !== 'undefined') canvas = new OffscreenCanvas(size.width, size.height);
    else {
      const element = document.createElement('canvas');
      element.width = size.width; element.height = size.height; canvas = element;
    }
    const context = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context) throw new Error('Your browser could not prepare this image for export.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    if (settings.format === 'image/jpeg') { context.fillStyle = settings.background; context.fillRect(0, 0, size.width, size.height); }
    context.drawImage(decoded.source, 0, 0, size.width, size.height);
    const encode = (quality: number) => {
      if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) return canvas.convertToBlob({ type: settings.format, quality });
      return exportCanvas(canvas as HTMLCanvasElement, settings.format, quality);
    };
    let blob: Blob;
    let targetMet: boolean | undefined;
    if (settings.targetBytes !== undefined) {
      if (settings.format === 'image/png') {
        blob = await encode(settings.quality);
        targetMet = blob.size <= settings.targetBytes;
      } else {
        const result = await chooseQualityForTarget(encode, settings.targetBytes, settings.quality);
        blob = result.blob;
        targetMet = result.targetMet;
      }
    } else blob = await encode(settings.quality);
    const actualFormat = blob.type.toLowerCase() as OutputFormat;
    if (actualFormat !== settings.format) throw new Error(`This browser cannot export ${settings.format.replace('image/', '').toUpperCase()} images. Try another output format.`);
    return { blob, url: URL.createObjectURL(blob), width: size.width, height: size.height, name: outputName ?? makeOutputName(file.name, actualFormat), format: actualFormat, ...(targetMet === undefined ? {} : { targetMet }) };
  } finally {
    decoded.close();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}
