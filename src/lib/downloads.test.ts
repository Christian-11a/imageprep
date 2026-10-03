import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { createZipBlob } from './downloads';

describe('createZipBlob', () => {
  it('keeps the processed filenames and image bytes in the archive', async () => {
    const source = new Blob([new Uint8Array([0, 1, 2, 255])], { type: 'image/png' });
    const archive = await createZipBlob([{ name: 'portrait-final.png', blob: source }]);
    const reopened = await JSZip.loadAsync(await archive.arrayBuffer());

    expect(Object.keys(reopened.files)).toEqual(['portrait-final.png']);
    expect([...await reopened.file('portrait-final.png')!.async('uint8array')]).toEqual([0, 1, 2, 255]);
    expect(archive.type).toBe('application/zip');
  });

  it('preserves every output when names collide case-insensitively', async () => {
    const archive = await createZipBlob([
      { name: '../same.png', blob: new Blob(['first']) },
      { name: 'SAME.PNG', blob: new Blob(['second']) },
    ]);
    const reopened = await JSZip.loadAsync(await archive.arrayBuffer());

    expect(Object.keys(reopened.files)).toEqual(['same.png', 'SAME (2).PNG']);
    expect(await reopened.file('same.png')!.async('string')).toBe('first');
    expect(await reopened.file('SAME (2).PNG')!.async('string')).toBe('second');
  });

  it('removes unsafe path and filename characters from archive entries', async () => {
    const archive = await createZipBlob([
      { name: 'folder/CON.png', blob: new Blob(['reserved']) },
      { name: 'x/portrait?.png. ', blob: new Blob(['unsafe']) },
    ]);
    const reopened = await JSZip.loadAsync(await archive.arrayBuffer());

    expect(Object.keys(reopened.files)).toEqual(['_CON.png', 'portrait_.png']);
    expect(reopened.files['_CON.png'].dir).toBe(false);
    expect(reopened.files['portrait_.png'].dir).toBe(false);
  });

  it('rejects an empty batch', async () => {
    await expect(createZipBlob([])).rejects.toThrow('There are no processed images to download.');
  });
});
