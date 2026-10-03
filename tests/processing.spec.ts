import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('real exports preserve aspect ratio and transparency; JPEG uses the chosen background', async ({ page }) => {
  const results = await page.evaluate(async () => {
    const modulePath = '/src/lib/imageProcessing.ts';
    const { processImage, inspectImage } = await import(/* @vite-ignore */ modulePath);
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 200;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#ef4444'; context.fillRect(200, 0, 200, 200);
    const input = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'));
    const file = new File([input], 'transparent.png', { type: 'image/png' });
    const settings = { format: 'image/png', maxWidth: 100, maxHeight: 100, quality: .8, background: '#00ff00' };
    const original = await inspectImage(file);
    const outputs = [];
    for (const format of ['image/png', 'image/jpeg', 'image/webp']) {
      const output = await processImage(file, { ...settings, format });
      const bitmap = await createImageBitmap(output.blob);
      const resultCanvas = document.createElement('canvas'); resultCanvas.width = bitmap.width; resultCanvas.height = bitmap.height;
      const resultContext = resultCanvas.getContext('2d')!;
      resultContext.drawImage(bitmap, 0, 0);
      outputs.push({ format: output.blob.type, width: bitmap.width, height: bitmap.height, name: output.name, pixel: [...resultContext.getImageData(5, 5, 1, 1).data] });
      bitmap.close(); URL.revokeObjectURL(output.url);
    }
    return { original, outputs };
  });
  expect(results.original).toEqual({ width: 400, height: 200 });
  expect(results.outputs.map(o => [o.width, o.height])).toEqual([[100, 50], [100, 50], [100, 50]]);
  expect(results.outputs.map(o => o.format)).toEqual(['image/png', 'image/jpeg', 'image/webp']);
  expect(results.outputs.map(o => o.name)).toEqual(['transparent.png', 'transparent.jpg', 'transparent.webp']);
  expect(results.outputs[0].pixel[3]).toBe(0);
  expect(results.outputs[1].pixel[1]).toBeGreaterThan(245);
  expect(results.outputs[1].pixel[3]).toBe(255);
  expect(results.outputs[2].pixel[3]).toBe(0);
});

test('JPEG orientation is reflected in inspection and exports', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const modulePath = '/src/lib/imageProcessing.ts';
    const { processImage, inspectImage } = await import(/* @vite-ignore */ modulePath);
    const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 20;
    const context = canvas.getContext('2d')!; context.fillStyle = '#d946ef'; context.fillRect(0, 0, 40, 20);
    const jpeg = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/jpeg'));
    const bytes = new Uint8Array(await jpeg.arrayBuffer());
    const exif = new Uint8Array([255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0]);
    const file = new File([bytes.slice(0,2), exif, bytes.slice(2)], 'portrait.jpg', { type: 'image/jpeg' });
    const inspected = await inspectImage(file);
    const output = await processImage(file, { format: 'image/png', maxWidth: 100, maxHeight: 100, quality: .8, background: '#ffffff' });
    URL.revokeObjectURL(output.url);
    return { inspected, width: output.width, height: output.height };
  });
  expect(result.inspected).toEqual({ width: 20, height: 40 });
  expect([result.width, result.height]).toEqual([20, 40]);
});

test('lossy WebP dimensions decode correctly and never upscale', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const modulePath = '/src/lib/imageProcessing.ts';
    const { processImage, inspectImage } = await import(/* @vite-ignore */ modulePath);
    const canvas = document.createElement('canvas'); canvas.width = 321; canvas.height = 123;
    const context = canvas.getContext('2d')!; context.fillStyle = '#2563eb'; context.fillRect(0, 0, 321, 123);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/webp', .7));
    const file = new File([blob], 'blue.webp', { type: 'image/webp' });
    const inspected = await inspectImage(file);
    const output = await processImage(file, { format: 'image/webp', maxWidth: 1920, maxHeight: 1920, quality: .8, background: '#ffffff' });
    URL.revokeObjectURL(output.url);
    return { inspected, width: output.width, height: output.height };
  });
  expect(result.inspected).toEqual({ width: 321, height: 123 });
  expect([result.width, result.height]).toEqual([321, 123]);
});

test('corrupt images and oversized decoded dimensions are rejected', async ({ page }) => {
  const errors = await page.evaluate(async () => {
    const modulePath = '/src/lib/imageProcessing.ts';
    const { inspectImage } = await import(/* @vite-ignore */ modulePath);
    const oversizedHeader = new Uint8Array(33);
    oversizedHeader.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
    const view = new DataView(oversizedHeader.buffer); view.setUint32(16, 10000); view.setUint32(20, 10000);
    const files = [new File(['broken'], 'broken.png', {type:'image/png'}), new File([oversizedHeader], 'huge.png', {type:'image/png'})];
    const result = [];
    for (const file of files) { try { await inspectImage(file); result.push('accepted'); } catch (error) { result.push((error as Error).message); } }
    return result;
  });
  expect(errors[0]).toMatch(/readable|read|contain/i);
  expect(errors[1]).toMatch(/20 megapixels/i);
});
