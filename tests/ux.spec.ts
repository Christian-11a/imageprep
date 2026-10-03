import { test, expect, type Page } from '@playwright/test';
import { stat } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';

async function expectNoAccessibilityViolations(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations.map(issue => ({ id: issue.id, targets: issue.nodes.map(node => node.target) }))).toEqual([]);
}

async function pngBytes(page: Page, width = 120, height = 80) {
  const base64 = await page.evaluate(({ width, height }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#6b7855';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#d8b16a';
    context.fillRect(Math.floor(width / 2), 0, Math.ceil(width / 2), height);
    return canvas.toDataURL('image/png').split(',')[1];
  }, { width, height });
  return Buffer.from(base64, 'base64');
}

async function densePngBytes(page: Page, width = 800, height = 600) {
  const base64 = await page.evaluate(({ width, height }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d')!;
    const image = context.createImageData(width, height);
    // A deterministic high-detail field stays larger than 1 KB even at low WebP quality.
    let seed = 72419;
    for (let index = 0; index < image.data.length; index += 4) {
      seed = (seed * 48271) % 0x7fffffff;
      image.data[index] = seed & 255;
      image.data[index + 1] = (seed >>> 8) & 255;
      image.data[index + 2] = (seed >>> 16) & 255;
      image.data[index + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png').split(',')[1];
  }, { width, height });
  return Buffer.from(base64, 'base64');
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
});

test('unsupported files get individual reasons while supported files remain available', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const valid = await pngBytes(page);
  await page.locator('input[type="file"]').setInputFiles([
    { name: 'animated.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') },
    { name: 'kept-photo.png', mimeType: 'image/png', buffer: valid },
  ]);

  const rejectionReport = page.locator('.upload-rejections');
  await expect(rejectionReport).toBeVisible();
  await expect(rejectionReport).toContainText('animated.gif');
  await expect(rejectionReport).toContainText(/Choose a JPEG, PNG, or WebP image/i);
  await expect(rejectionReport).toContainText(/Choose a still JPG, PNG, or WebP image/i);
  await expect(page.locator('.image-list [role="listitem"]')).toHaveCount(1);
  await expect(page.locator('.image-list')).toContainText('kept-photo.png');
  await expect(rejectionReport).toContainText(/Accepted images stay in your batch/i);
  await page.locator('#rejections-title').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'docs/screenshots/ux-mobile.png' });
  await expectNoAccessibilityViolations(page);
});

test('a rejected first file does not consume a slot ahead of ten valid images', async ({ page }) => {
  const valid = await pngBytes(page);
  await page.locator('input[type="file"]').setInputFiles([
    { name: 'first.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') },
    ...Array.from({ length: 10 }, (_, index) => ({
      name: `valid-${index + 1}.png`, mimeType: 'image/png', buffer: valid,
    })),
  ]);

  await expect(page.locator('.image-list [role="listitem"]')).toHaveCount(10);
  await expect(page.locator('.image-list')).toContainText('valid-10.png');
  await expect(page.locator('.upload-rejections')).toContainText(/first.gif[\s\S]*Choose a JPEG, PNG, or WebP image/i);
  await expect(page.locator('.count-pill')).toContainText('10 / 10');
});

test('decoded memory budget rejects an extra image and admits it after one is removed', async ({ page }) => {
  await page.addInitScript(() => {
    const decode = window.createImageBitmap.bind(window);
    window.createImageBitmap = (async (...args: Parameters<typeof window.createImageBitmap>) => {
      const bitmap = await decode(...args);
      return {
        width: 5000,
        height: 4000,
        close: () => bitmap.close(),
      } as ImageBitmap;
    }) as typeof window.createImageBitmap;
  });
  await page.reload();

  const valid = await pngBytes(page);
  const files = Array.from({ length: 3 }, (_, index) => ({
    name: `memory-${index + 1}.png`, mimeType: 'image/png', buffer: valid,
  }));
  await page.locator('input[type="file"]').setInputFiles(files);

  await expect(page.locator('.image-list [role="listitem"]')).toHaveCount(2);
  await expect(page.locator('.image-list')).toContainText('memory-2.png');
  await expect(page.locator('.upload-rejections')).toContainText('memory-3.png');
  await expect(page.locator('.upload-rejections')).toContainText(/40 megapixel total batch limit/i);
  await expect(page.locator('.image-list')).toContainText('5000 × 4000');

  await page.getByRole('button', { name: 'Remove memory-1.png', exact: true }).click();
  await expect(page.locator('.image-list [role="listitem"]')).toHaveCount(1);
  await page.locator('input[type="file"]').setInputFiles([files[2]]);
  await expect(page.locator('.image-list [role="listitem"]')).toHaveCount(2);
  await expect(page.locator('.image-list')).toContainText('memory-3.png');
  await expect(page.locator('.upload-rejections')).toHaveCount(0);
});

test('format help retains pixel limits and explains unsupported formats', async ({ page }) => {
  await page.getByRole('button', { name: 'Try a sample image' }).click();
  const disclosure = page.locator('.supported-details');
  await expect(disclosure).toBeVisible();
  await disclosure.locator('summary').click();
  await expect(disclosure).toContainText('20 megapixels');
  await expect(disclosure).toContainText(/not supported/i);
});

test('editing a dimension draft preserves the prepared image until blur and marks only the invalid field', async ({ page }) => {
  await page.getByRole('button', { name: 'Try a sample image' }).click();
  await page.getByRole('button', { name: /Prepare images|Process images/ }).click();
  await expect(page.getByRole('button', { name: 'Download all', exact: true })).toBeVisible();
  await expect(page.locator('.settings-hint')).toBeVisible();

  const width = page.getByLabel('Max width', { exact: true });
  const height = page.getByLabel('Max height', { exact: true });
  await width.fill('1200');
  await expect(page.getByRole('button', { name: 'Download all', exact: true })).toBeVisible();
  await page.getByRole('heading', { name: 'Make it fit.' }).click();
  await expect(page.getByRole('button', { name: 'Download all', exact: true })).toHaveCount(0);
  await expect(page.locator('.settings-update-hint')).toBeVisible();
  await page.getByRole('button', { name: /Prepare images|Process images/ }).click();
  await expect(page.getByRole('button', { name: 'Download all', exact: true })).toBeVisible();

  await width.fill('0');
  await expect(width).toHaveAttribute('aria-invalid', 'false');
  await expect(height).toHaveAttribute('aria-invalid', 'false');
  await expect(page.getByRole('button', { name: 'Download all', exact: true })).toBeVisible();

  await page.getByRole('heading', { name: 'Make it fit.' }).click();
  await expect(width).toHaveAttribute('aria-invalid', 'true');
  await expect(height).toHaveAttribute('aria-invalid', 'false');
});

test('undoing a clear restores prepared output, preview, and download actions', async ({ page }) => {
  await page.getByRole('button', { name: 'Try a sample image' }).click();
  await page.getByRole('button', { name: /Prepare images|Process images/ }).click();
  await expect(page.getByRole('button', { name: 'Download all', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo clear' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Download all', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Preview mountain-sunset.jpg', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('img', { name: /Original/ })).toBeVisible();
  await expect(dialog.getByRole('img', { name: /Prepared/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Save image' })).toBeEnabled();
});

test('target file size prepares the sample below 50 KB and reports when a dense image cannot reach 1 KB', async ({ page }) => {
  await page.getByRole('button', { name: 'Try a sample image' }).click();
  await page.getByLabel('Try to stay under a file size').check();
  const targetSize = page.getByLabel('Target file size');
  await targetSize.fill('10241');
  await expect(targetSize).toHaveAttribute('aria-invalid', 'false');
  await page.getByRole('heading', { name: 'Make it fit.' }).click();
  await expect(targetSize).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: /Prepare images|Process images/ })).toBeDisabled();

  await page.getByLabel('Output format').selectOption('image/png');
  const targetToggle = page.locator('.target-size-toggle input[type="checkbox"]');
  await expect(targetToggle).toBeDisabled();
  await expect(targetToggle).not.toBeChecked();
  await expect(page.getByLabel('Target file size')).toHaveCount(0);
  await page.getByLabel('Output format').selectOption('image/webp');
  await page.getByLabel('Try to stay under a file size').check();
  await page.getByLabel('Target file size').fill('50');
  await expectNoAccessibilityViolations(page);
  await page.getByRole('button', { name: /Prepare images|Process images/ }).click();
  await expect(page.locator('.target-size-result')).toContainText(/within target/i);

  const sampleDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download mountain-sunset.webp', exact: true }).click();
  const sample = await sampleDownload;
  expect(await stat((await sample.path())!).then(file => file.size)).toBeLessThanOrEqual(50 * 1000);

  await page.getByRole('button', { name: 'Clear all' }).click();
  const dense = await densePngBytes(page);
  await page.locator('input[type="file"]').setInputFiles({ name: 'dense-texture.png', mimeType: 'image/png', buffer: dense });
  await page.getByLabel('Target file size').fill('1');
  await page.getByRole('button', { name: /Prepare images|Process images/ }).click();
  await expect(page.locator('.target-size-result')).toContainText(/exceeded/i);
  const denseDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download dense-texture\.webp/ }).click();
  const denseOutput = await denseDownload;
  expect(await stat((await denseOutput.path())!).then(file => file.size)).toBeGreaterThan(1000);
});

test('mobile sticky actions remain in the viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: 'Try a sample image' }).click();
  const mobileActions = page.locator('.mobile-actions');
  await expect(mobileActions).toBeVisible();
  const bounds = await mobileActions.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(mobileActions).toBeInViewport();
  await expect(page.locator('html')).toHaveJSProperty('clientWidth', 375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await mobileActions.getByRole('link', { name: 'Choose settings' }).click();
  await page.getByRole('button', { name: /Prepare images|Process images/ }).click();
  await expect(mobileActions.getByRole('button', { name: 'Download batch ZIP' })).toBeVisible();
  await expectNoAccessibilityViolations(page);
});
