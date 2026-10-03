import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, LIMITS } from '../types';
import {
  calculateDimensions, formatBytes, getSizeChange, makeOutputName, reserveUniqueName,
  chooseQualityForTarget, readHeaderDimensions, validateBatchBudget, validateInputFile, validateSettings,
} from './imageProcessing';

describe('calculateDimensions', () => {
  it('keeps aspect ratio when fitting within both limits', () => {
    expect(calculateDimensions(4000, 2000, 1920, 1080)).toEqual({ width: 1920, height: 960 });
    expect(calculateDimensions(800, 1200, 500, 500)).toEqual({ width: 333, height: 500 });
  });

  it('does not upscale smaller images and rejects invalid dimensions', () => {
    expect(calculateDimensions(320, 240, 1000, 1000)).toEqual({ width: 320, height: 240 });
    expect(() => calculateDimensions(0, 200, 100, 100)).toThrow(/positive/);
  });
});

describe('settings and input validation', () => {
  it('accepts defaults and rejects invalid format, dimensions, quality, or background', () => {
    expect(() => validateSettings(DEFAULT_SETTINGS)).not.toThrow();
    expect(() => validateSettings({ ...DEFAULT_SETTINGS, maxWidth: 5000 })).toThrow(/Maximum width/);
    expect(() => validateSettings({ ...DEFAULT_SETTINGS, quality: 1.1 })).toThrow(/Quality/);
    expect(() => validateSettings({ ...DEFAULT_SETTINGS, background: 'white' })).toThrow(/hex color/);
    expect(() => validateSettings({ ...DEFAULT_SETTINGS, format: 'image/gif' as never })).toThrow(/output format/);
    expect(() => validateSettings({ ...DEFAULT_SETTINGS, targetBytes: 0 })).toThrow(/Target file size/);
    expect(() => validateSettings({ ...DEFAULT_SETTINGS, targetBytes: 1.5 })).toThrow(/Target file size/);
    expect(() => validateSettings({ ...DEFAULT_SETTINGS, targetBytes: 10 * 1024 * 1024 + 1 })).toThrow(/Target file size/);
    expect(() => validateSettings({ ...DEFAULT_SETTINGS, targetBytes: 10 * 1024 * 1024 })).not.toThrow();
  });

  it('uses the extension when the browser omits MIME type and rejects mismatches or large files', () => {
    expect(() => validateInputFile(new File(['image'], 'picture.webp', { type: '' }))).not.toThrow();
    expect(() => validateInputFile(new File(['image'], 'picture.png', { type: 'image/jpeg' }))).toThrow(/do not match/);
    const large = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' });
    expect(() => validateInputFile(large)).toThrow(/10 MB/);
    expect(() => validateInputFile(new File([], 'empty.jpg', { type: 'image/jpeg' }))).toThrow(/empty/);
  });
});

describe('image header dimensions', () => {
  it('reads WebP VP8 dimensions as little-endian values', () => {
    const header = new Uint8Array(30);
    header.set([...new TextEncoder().encode('VP8 ')], 12);
    header[26] = 0x34; header[27] = 0x12;
    header[28] = 0x56; header[29] = 0x01;
    expect(readHeaderDimensions(header, 'image/webp')).toEqual({ width: 0x1234, height: 0x0156 });
  });

  it('requires the PNG IHDR chunk before trusting its width and height', () => {
    const header = new Uint8Array(24);
    header.set([...new TextEncoder().encode('IHDR')], 12);
    header.set([0, 0, 7, 8], 16);
    header.set([0, 0, 4, 176], 20);
    expect(readHeaderDimensions(header, 'image/png')).toEqual({ width: 1800, height: 1200 });
    header[12] = 0;
    expect(readHeaderDimensions(header, 'image/png')).toBeNull();
  });
});

describe('filenames and sizes', () => {
  it('replaces only the final extension and picks a format-appropriate suffix', () => {
    expect(makeOutputName('photo.final.PNG', 'image/jpeg')).toBe('photo.final.jpg');
    expect(makeOutputName('folder\\photo', 'image/webp')).toBe('photo.webp');
    expect(makeOutputName('CON.png', 'image/jpeg')).toBe('_CON.jpg');
    expect(makeOutputName('photo:final?.png', 'image/webp')).toBe('photo_final_.webp');
  });

  it('reserves unique names case-insensitively and preserves extensions', () => {
    const used = new Set<string>();
    expect(reserveUniqueName('Photo.jpg', used)).toBe('Photo.jpg');
    expect(reserveUniqueName('photo.jpg', used)).toBe('photo (2).jpg');
    expect(reserveUniqueName('photo.jpg', used)).toBe('photo (3).jpg');
    expect(used).toEqual(new Set(['photo.jpg', 'photo (2).jpg', 'photo (3).jpg']));
  });

  it('formats byte counts and reports savings with negative growth', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB');
    expect(getSizeChange(100, 70)).toBe(30);
    expect(getSizeChange(100, 125)).toBe(-25);
    expect(getSizeChange(0, 20)).toBe(0);
  });
});

describe('target-size quality search', () => {
  it('finds the highest sampled quality that reaches the target within seven encodes', async () => {
    const qualities: number[] = [];
    const result = await chooseQualityForTarget(async quality => {
      qualities.push(quality);
      return new Blob([new Uint8Array(Math.round(quality * 1000))], { type: 'image/webp' });
    }, 451, 0.8);

    expect(result.targetMet).toBe(true);
    expect(result.blob.size).toBeLessThanOrEqual(451);
    expect(result.quality).toBeGreaterThan(0.4);
    expect(qualities).toHaveLength(7);
    expect(qualities.length).toBeLessThanOrEqual(7);
  });

  it('returns the minimum-quality export and reports failure when the target is impossible', async () => {
    const qualities: number[] = [];
    const result = await chooseQualityForTarget(async quality => {
      qualities.push(quality);
      return new Blob([new Uint8Array(Math.round(quality * 1000))], { type: 'image/jpeg' });
    }, 50, 0.8);

    expect(result.targetMet).toBe(false);
    expect(result.quality).toBe(0.1);
    expect(result.blob.size).toBe(100);
    expect(qualities).toEqual([0.8, 0.1]);
  });
});

describe('batch memory admission', () => {
  it('allows exact byte and decoded-pixel budgets', () => {
    expect(() => validateBatchBudget(
      { bytes: LIMITS.maxBatchBytes - 1024, pixels: LIMITS.maxBatchPixels - 1000 },
      { bytes: 1024, pixels: 1000 },
    )).not.toThrow();
  });

  it('rejects the next byte or pixel beyond either total limit', () => {
    expect(() => validateBatchBudget(
      { bytes: LIMITS.maxBatchBytes, pixels: 0 },
      { bytes: 1, pixels: 0 },
    )).toThrow(/50 MB total batch limit/);
    expect(() => validateBatchBudget(
      { bytes: 0, pixels: LIMITS.maxBatchPixels },
      { bytes: 0, pixels: 1 },
    )).toThrow(/40 megapixel total batch limit/);
  });

  it('admits new files against the reduced budget after removal', () => {
    // Removing a file is represented by passing the remaining byte and pixel totals.
    const remaining = { bytes: 38 * 1024 * 1024, pixels: 25_000_000 };
    const nextFile = { bytes: 12 * 1024 * 1024, pixels: 12_000_000 };
    expect(() => validateBatchBudget(remaining, nextFile)).not.toThrow();
  });

  it('rejects invalid budget measurements instead of allowing negative totals', () => {
    expect(() => validateBatchBudget({ bytes: -1, pixels: 0 }, { bytes: 1, pixels: 1 })).toThrow(/nonnegative/);
  });
});
