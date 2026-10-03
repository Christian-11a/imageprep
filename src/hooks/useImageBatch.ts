import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  DEFAULT_SETTINGS,
  LIMITS,
  type ImageItem,
  type ImageSettings,
  type ProcessedImage,
} from '../types';
import { inspectImage, makeOutputName, processImage, reserveUniqueName, validateBatchBudget, validateSettings } from '../lib/imageProcessing';
import { createSampleFile } from '../lib/sample';
import { downloadBlob, downloadZip } from '../lib/downloads';

export interface ImageBatchProgress {
  completed: number;
  total: number;
}

export type NoticeKind = 'success' | 'warning';
export interface UploadRejection { name: string; reason: string; recovery: string }

function recoveryFor(reason: string): string {
  if (/batch/.test(reason)) return 'Remove some images or split them into smaller batches, then try again.';
  if (/limit was reached/.test(reason)) return 'Remove an image from this batch, then add this file again.';
  if (/megapixels/.test(reason)) return 'Resize the original to 20 megapixels or less, then try again.';
  if (/10 MB|smaller/.test(reason)) return 'Choose a file under 10 MB or reduce its size first.';
  if (/Animated/.test(reason)) return 'Export a still frame as JPG, PNG, or WebP.';
  if (/match/.test(reason)) return 'Export the image in its actual format; renaming its extension does not convert it.';
  return 'Choose a still JPG, PNG, or WebP image. If it is damaged, export a fresh copy.';
}

export interface ImageBatch {
  items: ImageItem[];
  settings: ImageSettings;
  setSettings: Dispatch<SetStateAction<ImageSettings>>;
  isAdding: boolean;
  isProcessing: boolean;
  isZipping: boolean;
  progress: ImageBatchProgress;
  notice: string;
  noticeKind: NoticeKind;
  rejections: UploadRejection[];
  canUndoClear: boolean;
  settingsChanged: boolean;
  dismissRejections(): void;
  undoClear(): void;
  clearNotice(): void;
  addFiles(files: File[]): Promise<void>;
  addSample(): Promise<void>;
  removeItem(id: string): void;
  clearAll(): void;
  processAll(): Promise<void>;
  cancelProcessing(): void;
  downloadItem(id: string): void;
  downloadAll(): Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong while handling this image.';
}

function sameSettings(a: ImageSettings, b: ImageSettings): boolean {
  return a.format === b.format && a.maxWidth === b.maxWidth && a.maxHeight === b.maxHeight &&
    a.quality === b.quality && a.background === b.background && a.targetBytes === b.targetBytes;
}

export function useImageBatch(): ImageBatch {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [settings, setSettingsState] = useState<ImageSettings>(DEFAULT_SETTINGS);
  const [isAdding, setIsAdding] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [progress, setProgress] = useState<ImageBatchProgress>({ completed: 0, total: 0 });
  const [notice, setNotice] = useState('');
  const [noticeKind, setNoticeKind] = useState<NoticeKind>('warning');
  const [rejections, setRejections] = useState<UploadRejection[]>([]);
  const [canUndoClear, setCanUndoClear] = useState(false);
  const [settingsChanged, setSettingsChanged] = useState(false);
  // Keep one bounded snapshot without live URLs; expiry releases file/blob references.
  const clearedRef = useRef<ImageItem[]>([]);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const discardUndo = useCallback(() => {
    clearTimeout(undoTimerRef.current);
    clearedRef.current = [];
    if (aliveRef.current) setCanUndoClear(false);
  }, []);

  // Refs are the synchronous source of truth for async actions. This prevents
  // rapid clicks from starting work against a stale render.
  const itemsRef = useRef(items);
  const settingsRef = useRef(settings);
  const addingRef = useRef(false);
  const processingRef = useRef(false);
  const zippingRef = useRef(false);
  const cancelRef = useRef(false);
  const addGenerationRef = useRef(0);
  const aliveRef = useRef(true);
  const lifetimeRef = useRef(0);
  const ownedUrlsRef = useRef(new Set<string>());

  const ownUrl = useCallback((url: string) => {
    ownedUrlsRef.current.add(url);
    return url;
  }, []);

  const releaseUrl = useCallback((url?: string) => {
    if (url && ownedUrlsRef.current.delete(url)) URL.revokeObjectURL(url);
  }, []);

  const replaceItems = useCallback((next: ImageItem[]) => {
    itemsRef.current = next;
    if (aliveRef.current) setItems(next);
  }, []);
  const notify = useCallback((message: string, kind: NoticeKind = 'warning') => {
    if (aliveRef.current) {
      setNotice(message);
      setNoticeKind(kind);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    lifetimeRef.current += 1;
    return () => {
      aliveRef.current = false;
      clearTimeout(undoTimerRef.current);
      clearedRef.current = [];
      addGenerationRef.current += 1;
      const cleanupLifetime = ++lifetimeRef.current;
      // React StrictMode immediately re-runs effects in development. Deferring
      // cleanup one microtask lets that setup cancel this simulated unmount.
      queueMicrotask(() => {
        if (aliveRef.current || lifetimeRef.current !== cleanupLifetime) return;
        for (const url of ownedUrlsRef.current) URL.revokeObjectURL(url);
        ownedUrlsRef.current.clear();
      });
    };
  }, []);

  const setSettings = useCallback<Dispatch<SetStateAction<ImageSettings>>>((value) => {
    if (processingRef.current || addingRef.current || zippingRef.current) return;
    const next = typeof value === 'function' ? value(settingsRef.current) : value;
    if (sameSettings(next, settingsRef.current)) return;
    discardUndo();
    settingsRef.current = next;
    if (aliveRef.current) setSettingsState(next);
    notify('');

    const current = itemsRef.current;
    if (current.some(item => item.output)) setSettingsChanged(true);
    for (const item of current) releaseUrl(item.output?.url);
    replaceItems(current.map((item) => ({
      ...item,
      status: 'ready',
      output: undefined,
      error: undefined,
    })));
  }, [discardUndo, notify, releaseUrl, replaceItems]);

  const clearNotice = useCallback(() => notify(''), [notify]);

  const addFiles = useCallback(async (files: File[]) => {
    if (addingRef.current || processingRef.current || zippingRef.current) {
      notify('Wait for the current batch action to finish before adding images.');
      return;
    }
    if (files.length === 0) return;

    const room = Math.max(0, LIMITS.maxFiles - itemsRef.current.length);
    discardUndo();

    addingRef.current = true;
    setIsAdding(true);
    notify('');
    setRejections([]);
    const generation = ++addGenerationRef.current;
    const accepted: ImageItem[] = [];
    const failures: UploadRejection[] = [];
    let rejectedCount = 0;

    try {
      for (const file of files) {
        if (generation !== addGenerationRef.current) break;
        if (accepted.length >= room) {
          rejectedCount++;
          const reason = `The ${LIMITS.maxFiles}-image limit was reached.`;
          failures.push({ name: file.name, reason, recovery: recoveryFor(reason) });
          continue;
        }
        try {
          if (file.size > LIMITS.maxBytes) {
            throw new Error('This file is larger than the 10 MB limit.');
          }
          const dimensions = await inspectImage(file);
          if (generation !== addGenerationRef.current) break;
          const totals = [...itemsRef.current, ...accepted].reduce((sum, item) => ({
            bytes: sum.bytes + item.file.size, pixels: sum.pixels + item.width * item.height,
          }), { bytes: 0, pixels: 0 });
          validateBatchBudget(totals, { bytes: file.size, pixels: dimensions.width * dimensions.height });
          const originalUrl = ownUrl(URL.createObjectURL(file));
          accepted.push({
            id: crypto.randomUUID(),
            file,
            originalUrl,
            width: dimensions.width,
            height: dimensions.height,
            status: 'ready',
          });
        } catch (error) {
          const reason = errorMessage(error);
          failures.push({ name: file.name, reason, recovery: recoveryFor(reason) });
        }
      }

      if (generation !== addGenerationRef.current) {
        for (const item of accepted) releaseUrl(item.originalUrl);
        return;
      }
      replaceItems([...itemsRef.current, ...accepted]);
      setRejections(failures);
      const parts: string[] = [];
      if (accepted.length) parts.push(`Added ${accepted.length} image${accepted.length === 1 ? '' : 's'}.`);
      if (rejectedCount) parts.push(`${rejectedCount} file${rejectedCount === 1 ? '' : 's'} skipped because the ${LIMITS.maxFiles}-image limit was reached.`);
      if (failures.length) parts.push(`${failures.length} not added: ${failures.slice(0, 3).map(file => file.name).join(', ')}${failures.length > 3 ? ', and more' : ''}. See reasons below.`);
      notify(parts.join(' '), rejectedCount || failures.length ? 'warning' : 'success');
    } finally {
      if (generation === addGenerationRef.current) {
        addingRef.current = false;
        if (aliveRef.current) setIsAdding(false);
      }
    }
  }, [discardUndo, notify, ownUrl, releaseUrl, replaceItems]);

  const addSample = useCallback(async () => {
    if (addingRef.current || processingRef.current || zippingRef.current) {
      notify('Wait for the current batch action to finish before adding an example.');
      return;
    }
    addingRef.current = true;
    setIsAdding(true);
    const generation = ++addGenerationRef.current;
    try {
      const file = await createSampleFile();
      if (generation !== addGenerationRef.current) return;
      // Transfer the reservation directly to addFiles without yielding between
      // the release and call, so another action cannot claim the slot.
      addingRef.current = false;
      if (aliveRef.current) setIsAdding(false);
      await addFiles([file]);
    } catch (error) {
      notify(`Could not create the example image: ${errorMessage(error)}`);
    } finally {
      if (generation === addGenerationRef.current) {
        addingRef.current = false;
        if (aliveRef.current) setIsAdding(false);
      }
    }
  }, [addFiles, notify]);

  const removeItem = useCallback((id: string) => {
    if (processingRef.current || addingRef.current || zippingRef.current) return;
    const current = itemsRef.current;
    const removed = current.find((item) => item.id === id);
    if (!removed) return;
    releaseUrl(removed.originalUrl);
    releaseUrl(removed.output?.url);
    replaceItems(current.filter((item) => item.id !== id));
  }, [releaseUrl, replaceItems]);

  const clearAll = useCallback(() => {
    if (processingRef.current || zippingRef.current) return;
    if (addingRef.current) {
      addGenerationRef.current += 1;
      addingRef.current = false;
      if (aliveRef.current) setIsAdding(false);
    }
    discardUndo();
    const previous = itemsRef.current;
    clearedRef.current = previous;
    setCanUndoClear(previous.length > 0);
    if (previous.length) undoTimerRef.current = setTimeout(discardUndo, 15_000);
    for (const item of previous) {
      releaseUrl(item.originalUrl);
      releaseUrl(item.output?.url);
    }
    replaceItems([]);
    setRejections([]);
    setSettingsChanged(false);
    setProgress({ completed: 0, total: 0 });
    notify('');
  }, [discardUndo, notify, releaseUrl, replaceItems]);

  const undoClear = useCallback(() => {
    if (processingRef.current || addingRef.current || zippingRef.current || itemsRef.current.length) return;
    const previous = clearedRef.current;
    if (!previous.length) return;
    replaceItems(previous.map(item => ({ ...item,
      originalUrl: ownUrl(URL.createObjectURL(item.file)),
      output: item.output ? { ...item.output, url: ownUrl(URL.createObjectURL(item.output.blob)) } : undefined,
    })));
    discardUndo();
    notify('Your cleared images have been restored.', 'success');
  }, [discardUndo, notify, ownUrl, replaceItems]);

  const processAll = useCallback(async () => {
    if (processingRef.current || addingRef.current || zippingRef.current) return;
    try {
      validateSettings(settingsRef.current);
    } catch (error) {
      notify(errorMessage(error));
      return;
    }
    const candidates = itemsRef.current.filter((item) => !item.output);
    if (!candidates.length) {
      notify(itemsRef.current.length ? 'All images are already processed.' : 'Add images before processing.');
      return;
    }

    processingRef.current = true;
    discardUndo();
    setSettingsChanged(false);
    cancelRef.current = false;
    setIsProcessing(true);
    notify('');
    setProgress({ completed: 0, total: candidates.length });
    const candidateIds = new Set(candidates.map((item) => item.id));
    replaceItems(itemsRef.current.map((item) => candidateIds.has(item.id)
      ? { ...item, status: 'ready', error: undefined }
      : item));

    const settingsSnapshot = settingsRef.current;
    const usedNames = new Set(itemsRef.current
      .flatMap((item) => item.output ? [item.output.name.toLocaleLowerCase()] : []));
    let completed = 0;
    let succeeded = 0;
    let failed = 0;
    let targetsMissed = 0;
    let stopped = false;

    try {
      for (const item of candidates) {
        if (!aliveRef.current) {
          stopped = true;
          break;
        }
        if (cancelRef.current) {
          stopped = true;
          break;
        }
        replaceItems(itemsRef.current.map((entry) => entry.id === item.id
          ? { ...entry, status: 'processing', error: undefined }
          : entry));
        const outputName = reserveUniqueName(makeOutputName(item.file.name, settingsSnapshot.format), usedNames);
        let output: ProcessedImage | undefined;
        try {
          output = await processImage(item.file, settingsSnapshot, outputName);
          if (!aliveRef.current) {
            URL.revokeObjectURL(output.url);
            stopped = true;
            break;
          }
          ownUrl(output.url);
          succeeded += 1;
          if (output.targetMet === false) targetsMissed++;
          const current = itemsRef.current;
          replaceItems(current.map((entry) => entry.id === item.id
            ? { ...entry, status: 'done', output, error: undefined }
            : entry));
        } catch (error) {
          failed += 1;
          const message = errorMessage(error);
          const current = itemsRef.current;
          replaceItems(current.map((entry) => entry.id === item.id
            ? { ...entry, status: 'error', output: undefined, error: message }
            : entry));
        }
        completed += 1;
        if (aliveRef.current) setProgress({ completed, total: candidates.length });
      }

      if (cancelRef.current) stopped = true;
      if (stopped) {
        const pendingIds = new Set(candidates.slice(completed).map((item) => item.id));
        replaceItems(itemsRef.current.map((item) => pendingIds.has(item.id)
          ? { ...item, status: 'ready' }
          : item));
      }
      const messages = [`Processed ${succeeded} image${succeeded === 1 ? '' : 's'}.`];
      if (failed) messages.push(`${failed} failed; successful outputs are ready to download.`);
      if (targetsMissed) messages.push(`${targetsMissed} exceeded the file-size target. Try smaller dimensions to reduce their size further.`);
      if (stopped) messages.push('Processing stopped after the current image.');
      notify(messages.join(' '), failed || stopped || targetsMissed ? 'warning' : 'success');
    } finally {
      processingRef.current = false;
      cancelRef.current = false;
      if (aliveRef.current) setIsProcessing(false);
    }
  }, [discardUndo, notify, ownUrl, replaceItems]);

  const cancelProcessing = useCallback(() => {
    if (processingRef.current) {
      cancelRef.current = true;
      notify('Stopping after the current image. Completed images will stay available.');
    }
  }, [notify]);

  const downloadItem = useCallback((id: string) => {
    const item = itemsRef.current.find((entry) => entry.id === id);
    if (!item?.output) return;
    try {
      downloadBlob(item.output.blob, item.output.name);
    } catch (error) {
      notify(`Could not download ${item.output.name}: ${errorMessage(error)}`);
    }
  }, [notify]);

  const downloadAll = useCallback(async () => {
    if (zippingRef.current || addingRef.current || processingRef.current) return;
    const outputs = itemsRef.current.flatMap((item) => item.output
      ? [{ name: item.output.name, blob: item.output.blob }]
      : []);
    if (!outputs.length) {
      notify('Process at least one image before downloading the batch.');
      return;
    }
    zippingRef.current = true;
    setIsZipping(true);
    try {
      await downloadZip(outputs);
      notify(`Downloaded ${outputs.length} processed image${outputs.length === 1 ? '' : 's'} as a ZIP file.`, 'success');
    } catch (error) {
      notify(`Could not create the ZIP file: ${errorMessage(error)}`);
    } finally {
      zippingRef.current = false;
      if (aliveRef.current) setIsZipping(false);
    }
  }, [notify]);

  return {
    items,
    settings,
    setSettings,
    isAdding,
    isProcessing,
    isZipping,
    progress,
    notice,
    noticeKind,
    rejections,
    canUndoClear,
    settingsChanged,
    undoClear,
    dismissRejections: () => setRejections([]),
    clearNotice,
    addFiles,
    addSample,
    removeItem,
    clearAll,
    processAll,
    cancelProcessing,
    downloadItem,
    downloadAll,
  };
}
