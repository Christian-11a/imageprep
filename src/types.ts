export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ImageSettings {
  format: OutputFormat;
  maxWidth: number;
  maxHeight: number;
  quality: number;
  background: string;
  targetBytes?: number;
}

export interface ProcessedImage {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  name: string;
  format: OutputFormat;
  targetMet?: boolean;
}

export interface ImageItem {
  id: string;
  file: File;
  originalUrl: string;
  width: number;
  height: number;
  status: 'ready' | 'processing' | 'done' | 'error';
  output?: ProcessedImage;
  error?: string;
}

export const DEFAULT_SETTINGS: ImageSettings = {
  format: 'image/webp', maxWidth: 1920, maxHeight: 1920, quality: 0.8, background: '#ffffff',
};

export const LIMITS = {
  maxFiles: 10,
  maxBytes: 10 * 1024 * 1024,
  maxPixels: 20_000_000,
  maxBatchBytes: 50 * 1024 * 1024,
  maxBatchPixels: 40_000_000,
  maxOutputDimension: 4096,
} as const;
