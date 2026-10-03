import { sanitizeFilename } from './filenames';

/** Trigger a browser download for an existing blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = sanitizeFilename(filename);
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Browsers need a short moment to start reading the object URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Build an archive containing every supplied output blob and download it. */
export async function downloadZip(
  files: Array<{ name: string; blob: Blob }>,
  archiveName = 'imageprep-exports.zip',
): Promise<void> {
  const blob = await createZipBlob(files);
  downloadBlob(blob, archiveName);
}

/** Create a ZIP blob without starting a browser download. */
export async function createZipBlob(files: Array<{ name: string; blob: Blob }>): Promise<Blob> {
  if (files.length === 0) throw new Error('There are no processed images to download.');

  // Load JSZip only when the user requests a batch download.
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const used = new Set<string>();
  for (const file of files) zip.file(uniqueSafeZipName(file.name, used), file.blob);
  // Image formats are already compressed, so recompressing wastes CPU.
  return zip.generateAsync({ type: 'blob', compression: 'STORE' });
}

/** Keep archive entries flat, portable, and unique on case-insensitive filesystems. */
function uniqueSafeZipName(input: string, used: Set<string>): string {
  const safe = sanitizeFilename(input);

  const dot = safe.lastIndexOf('.');
  const stem = dot > 0 ? safe.slice(0, dot) : safe;
  const extension = dot > 0 ? safe.slice(dot) : '';
  let candidate = safe;
  let suffix = 2;
  while (used.has(candidate.toLocaleLowerCase())) candidate = `${stem} (${suffix++})${extension}`;
  used.add(candidate.toLocaleLowerCase());
  return candidate;
}
