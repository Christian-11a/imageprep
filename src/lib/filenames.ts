/** Flatten paths and produce a portable download name on common filesystems. */
export function sanitizeFilename(input: string): string {
  const basename = String(input).replace(/\\/g, '/').split('/').pop() ?? '';
  let safe = basename.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '_').trim().replace(/[. ]+$/g, '');
  if (!safe || safe === '.' || safe === '..') safe = 'image';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safe)) safe = `_${safe}`;
  return safe;
}
