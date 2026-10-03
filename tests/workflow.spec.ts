import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';

async function pngBytes(page: Page, width = 120, height = 80) {
  const base64 = await page.evaluate(({width, height}) => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#675be8'; context.fillRect(width / 2, 0, width / 2, height);
    return canvas.toDataURL('image/png').split(',')[1];
  }, {width, height});
  return Buffer.from(base64, 'base64');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
});

test('desktop and mobile workspace have no serious accessibility issues or horizontal overflow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await expect(page.getByRole('heading', { name: 'Small files. Big possibilities.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Prepare images|Prepare remaining|All images prepared/ })).toBeDisabled();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: 'docs/screenshots/workspace.png', fullPage: true });
  const desktopAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(desktopAxe.violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }))).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/mobile.png', fullPage: true });
  const mobileAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(mobileAxe.violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }))).toEqual([]);
  expect(errors).toEqual([]);
});

test('sample, live comparison dialog, single download, ZIP download, and settings invalidation work', async ({ page }) => {
  const networkWrites: string[] = [];
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) networkWrites.push(request.url()); });
  await page.getByRole('button', { name: 'Try a sample image' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', { name: 'Preview mountain-sunset.jpg', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save image' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /Prepare images|Prepare remaining|All images prepared/ }).click();
  await expect(page.getByRole('button', { name: 'Download all', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: 'docs/screenshots/prepared.png', fullPage: true });
  const singlePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download mountain-sunset.webp', exact: true }).click();
  const single = await singlePromise;
  expect(single.suggestedFilename()).toBe('mountain-sunset.webp');
  expect((await readFile((await single.path())!)).length).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Preview mountain-sunset.jpg', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('img', { name: /Prepared/ })).toBeVisible();
  const dialogAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(dialogAxe.violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }))).toEqual([]);
  await page.screenshot({ path: 'docs/screenshots/comparison.png', fullPage: true });
  await page.getByRole('button', { name: 'Close preview' }).click();
  const zipPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download all', exact: true }).click();
  const zip = await zipPromise;
  const archive = await JSZip.loadAsync(await readFile((await zip.path())!));
  expect(Object.keys(archive.files)).toEqual(['mountain-sunset.webp']);
  await page.getByLabel('Output format').selectOption('image/png');
  await expect(page.getByRole('button', { name: 'Download all', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Quality', { exact: true })).toBeDisabled();
  await page.getByLabel('Max width', { exact: true }).fill('0');
  await expect(page.getByRole('button', { name: /Prepare images|Prepare remaining|All images prepared/ })).toBeDisabled();
  await page.getByLabel('Max width', { exact: true }).fill('600');
  await page.getByRole('button', { name: /Prepare images|Prepare remaining|All images prepared/ }).click();
  await expect(page.getByRole('button', { name: 'Download mountain-sunset.png', exact: true })).toBeVisible();
  await expect(page.getByRole('listitem')).toContainText('600 × 400');
  expect(networkWrites).toEqual([]);
});

test('invalid uploads do not block valid duplicates; ZIP preserves both converted images', async ({ page }) => {
  const buffer = await pngBytes(page);
  await page.locator('input[type="file"]').setInputFiles([
    { name: 'portrait.png', mimeType: 'image/png', buffer },
    { name: 'portrait.png', mimeType: 'image/png', buffer },
    { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not an image') },
  ]);
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await expect(page.getByRole('status')).toContainText('broken.png');
  await page.getByLabel('Output format').selectOption('image/jpeg');
  await page.getByLabel('Max width', { exact: true }).fill('60');
  await page.getByLabel('Max height', { exact: true }).fill('40');
  await page.getByLabel('Transparent area', { exact: true }).fill('#00ff00');
  await page.getByRole('button', { name: /Prepare images|Prepare remaining|All images prepared/ }).click();
  await expect(page.getByRole('button', { name: 'Download portrait.jpg', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download portrait (2).jpg', exact: true })).toBeVisible();
  const zipPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download all', exact: true }).click();
  const zip = await zipPromise;
  const archive = await JSZip.loadAsync(await readFile((await zip.path())!));
  expect(Object.keys(archive.files)).toEqual(['portrait.jpg', 'portrait (2).jpg']);
  const bytes = await archive.file('portrait.jpg')!.async('uint8array');
  const decoded = await page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)], { type: 'image/jpeg' }));
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!; context.drawImage(bitmap, 0, 0);
    const result = { width: bitmap.width, height: bitmap.height, pixel: [...context.getImageData(5, 5, 1, 1).data] };
    bitmap.close(); return result;
  }, [...bytes]);
  expect([decoded.width, decoded.height]).toEqual([60, 40]);
  expect(decoded.pixel[1]).toBeGreaterThan(245);
  await page.locator('input[type="file"]').setInputFiles([{ name: 'portrait.png', mimeType: 'image/png', buffer }]);
  await expect(page.getByRole('listitem')).toHaveCount(3);
  await page.getByRole('button', { name: /Prepare images|Prepare remaining|All images prepared/ }).click();
  await expect(page.getByRole('button', { name: 'Download portrait (3).jpg', exact: true })).toBeVisible();
});

test('batch limits, removal, clearing, unsupported files, and file-size limits are enforced', async ({ page }) => {
  const buffer = await pngBytes(page);
  await page.locator('input[type="file"]').setInputFiles(Array.from({length: 11}, (_, i) => ({ name: `photo-${i}.png`, mimeType: 'image/png', buffer })));
  await expect(page.getByRole('listitem')).toHaveCount(10);
  await expect(page.getByRole('status')).toContainText('10-image limit');
  await page.getByRole('button', {name: 'Remove photo-0.png', exact: true}).click();
  await expect(page.getByRole('listitem')).toHaveCount(9);
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(0);
  await page.locator('input[type="file"]').setInputFiles([
    {name:'unsupported.gif', mimeType:'image/gif', buffer:Buffer.from('GIF89a')},
    {name:'too-large.png', mimeType:'image/png', buffer:Buffer.alloc(10 * 1024 * 1024 + 1)},
  ]);
  await expect(page.getByRole('listitem')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('too-large.png');
  await expect(page.getByRole('status')).toContainText('unsupported.gif');
});

test('cancellation retains completed images and allows the remaining batch to finish', async ({ page }) => {
  await page.addInitScript(() => {
    const original = OffscreenCanvas.prototype.convertToBlob;
    OffscreenCanvas.prototype.convertToBlob = async function(options) {
      await new Promise(resolve => setTimeout(resolve, 250));
      return original.call(this, options);
    };
  });
  await page.reload();
  const buffer = await pngBytes(page);
  await page.locator('input[type="file"]').setInputFiles(Array.from({length: 3}, (_, i) => ({name:`cancel-${i}.png`, mimeType:'image/png', buffer})));
  await expect(page.getByRole('listitem')).toHaveCount(3);
  await page.getByRole('button', { name: /Prepare images|Prepare remaining|All images prepared/ }).click();
  await expect(page.getByLabel('Output format')).toBeDisabled();
  await page.getByRole('button', {name:'Cancel preparation'}).click();
  await expect(page.getByRole('status')).toContainText('Processing stopped');
  await expect(page.getByRole('button', { name: 'Download all', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Prepare images|Prepare remaining|All images prepared/ })).toBeEnabled();
  await page.getByRole('button', { name: /Prepare images|Prepare remaining|All images prepared/ }).click();
  await expect(page.locator('.thumb-ready')).toHaveCount(3);
});

test('a failed export leaves successful outputs available and can be retried', async ({ page }) => {
  await page.addInitScript(() => {
    const original = OffscreenCanvas.prototype.convertToBlob;
    let calls = 0;
    OffscreenCanvas.prototype.convertToBlob = async function(options) {
      calls += 1;
      if (calls === 2) throw new Error('Simulated device export failure');
      return original.call(this, options);
    };
  });
  await page.reload();
  const buffer = await pngBytes(page);
  await page.locator('input[type="file"]').setInputFiles(Array.from({length: 3}, (_, i) => ({name:`partial-${i}.png`, mimeType:'image/png', buffer})));
  await expect(page.getByRole('listitem')).toHaveCount(3);
  await page.getByRole('button', {name:/Prepare images|Prepare remaining|All images prepared/}).click();
  await expect(page.getByRole('status')).toContainText('1 failed');
  await expect(page.locator('.thumb-ready')).toHaveCount(2);
  await expect(page.getByRole('button', {name:'Download all', exact:true})).toBeVisible();
  await expect(page.getByRole('button', {name:/Prepare images|Prepare remaining|All images prepared/})).toBeEnabled();
  await page.getByRole('button', {name:/Prepare images|Prepare remaining|All images prepared/}).click();
  await expect(page.locator('.thumb-ready')).toHaveCount(3);
  await expect(page.locator('.item-error')).toHaveCount(0);
});

test('clearing or changing settings releases image URLs', async ({ page }) => {
  await page.getByRole('button', {name:'Try a sample image'}).click();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  const originalUrl = await page.locator('.thumbnail-button img').getAttribute('src');
  await page.getByRole('button', {name:/Prepare images|Prepare remaining|All images prepared/}).click();
  await expect(page.getByRole('button', {name:'Download all', exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Preview mountain-sunset.jpg', exact:true}).click();
  const outputUrl = await page.getByRole('img', {name:/Prepared/}).getAttribute('src');
  await page.keyboard.press('Escape');
  await page.getByLabel('Output format').selectOption('image/png');
  expect(await page.evaluate(async (url) => { try { await fetch(url!); return false; } catch { return true; } }, outputUrl)).toBe(true);
  await page.getByRole('button', {name:'Clear all'}).click();
  expect(await page.evaluate(async (url) => { try { await fetch(url!); return false; } catch { return true; } }, originalUrl)).toBe(true);
  await expect(page.getByRole('listitem')).toHaveCount(0);
});

test('an open preview updates when preparation finishes and traps keyboard focus', async ({ page }) => {
  await page.addInitScript(() => {
    const original = OffscreenCanvas.prototype.convertToBlob;
    OffscreenCanvas.prototype.convertToBlob = async function(options) {
      await new Promise(resolve => setTimeout(resolve, 700));
      return original.call(this, options);
    };
  });
  await page.reload();
  await page.getByRole('button', {name:'Try a sample image'}).click();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', {name:/Prepare images|Prepare remaining|All images prepared/}).click();
  await page.getByRole('button', {name:'Preview mountain-sunset.jpg', exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('img', {name:/Prepared/})).toBeVisible();
  await expect(page.getByRole('button', {name:'Save image'})).toBeEnabled();
  await page.getByRole('button', {name:'Save image'}).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', {name:'Close preview'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', {name:'Preview mountain-sunset.jpg', exact:true})).toBeFocused();
});

test('prepared images and long filenames fit a narrow screen, including the comparison dialog', async ({ page }) => {
  await page.setViewportSize({width: 390, height: 844});
  const buffer = await pngBytes(page, 1200, 800);
  const name = 'a-very-long-photo-name-for-a-product-upload-that-needs-a-clear-preview.png';
  await page.locator('input[type="file"]').setInputFiles([{name, mimeType:'image/png', buffer}]);
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', {name:/Prepare images|Prepare remaining|All images prepared/}).click();
  await expect(page.getByRole('button', {name:'Download all', exact:true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const card = await page.getByRole('listitem').evaluate(element => ({scroll:element.scrollWidth, width:element.clientWidth}));
  expect(card.scroll).toBeLessThanOrEqual(card.width);
  await page.screenshot({path:'docs/screenshots/mobile-prepared.png', fullPage:true});
  await page.getByRole('button', {name:`Preview ${name}`, exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const dialog = await page.getByRole('dialog').evaluate(element => ({scroll:element.scrollWidth, width:element.clientWidth}));
  expect(dialog.scroll).toBeLessThanOrEqual(dialog.width);
  const close = (await page.getByRole('button', {name:'Close preview'}).boundingBox())!;
  expect(close.x + close.width).toBeLessThanOrEqual(390);
  const axe = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(axe.violations.map(issue => ({id:issue.id, targets:issue.nodes.map(node=>node.target)}))).toEqual([]);
});
